/**
 * Downloads openly licensed photos from Wikimedia Commons into ./data/<site>/<phase>/ using a manifest,
 * and writes data/ATTRIBUTION.md with author + licence for every file (required by CC BY / BY-SA).
 *
 *   npm run photos                       # uses data/manifest.json
 *   npm run photos -- --manifest my.json --max 12
 *
 * Manifest shape:
 * {
 *   "site-a": { "before": { "categories": ["Category:Litter in India"], "search": ["river bank plastic waste India"], "max": 10 },
 *               "after":  { ... } },
 *   ...
 * }
 *
 * Licences accepted: CC0, CC BY, CC BY-SA, Public domain, GODL-India, OGL. NC and ND variants are skipped.
 * Commons rate-limits aggressive clients; this script paces itself (2.5 s between API calls) and backs off on 429.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const UA = "FieldProof-hackathon/1.0 (student project; https://github.com/yabhinav1/fieldproof)";
const API = "https://commons.wikimedia.org/w/api.php";
const PACE_MS = 2500;
const MIN_WIDTH = 1000;
const DOWNLOAD_WIDTH = 2048;

type PhaseSpec = { categories?: string[]; search?: string[]; max?: number; exclude?: string[] };
type Manifest = Record<string, Record<string, PhaseSpec>>;

interface CommonsImage {
  title: string;
  pageid: number;
  width: number;
  height: number;
  mime: string;
  url: string;
  thumbUrl: string;
  descriptionUrl: string;
  license: string;
  artist: string;
  dateOriginal: string | null;
  gps: boolean;
  description: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const strip = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const licenseOk = (lic: string) => /CC0|CC BY|Public domain|PD|GODL|OGL/i.test(lic) && !/NC|ND/i.test(lic);

async function api(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${API}?format=json&${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const text = await res.text();
    if (res.status === 429 || text.startsWith("You are making too many")) {
      const wait = 20_000 * (attempt + 1);
      console.warn(`  commons rate limit, waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    return JSON.parse(text);
  }
  throw new Error("Commons API kept rate limiting; try again in a few minutes.");
}

function toImages(json: Record<string, unknown>): CommonsImage[] {
  const query = json.query as { pages?: Record<string, Record<string, unknown>> } | undefined;
  const pages = Object.values(query?.pages ?? {});
  const out: CommonsImage[] = [];
  for (const p of pages) {
    const ii = (p.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
    if (!ii) continue;
    const meta = (ii.extmetadata ?? {}) as Record<string, { value?: string }>;
    const license = meta.LicenseShortName?.value ?? "";
    if (!/jpeg/i.test(String(ii.mime)) || Number(ii.width) < MIN_WIDTH || !licenseOk(license)) continue;
    out.push({
      title: String(p.title),
      pageid: Number(p.pageid),
      width: Number(ii.width),
      height: Number(ii.height),
      mime: String(ii.mime),
      url: String(ii.url),
      thumbUrl: String(ii.thumburl ?? ii.url),
      descriptionUrl: String(ii.descriptionurl),
      license,
      artist: strip(meta.Artist?.value ?? "Unknown"),
      dateOriginal: meta.DateTimeOriginal?.value ?? null,
      gps: Boolean(meta.GPSLatitude?.value),
      description: strip(meta.ImageDescription?.value ?? "").slice(0, 200),
    });
  }
  return out;
}

const IMAGEINFO = {
  prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata",
  iiextmetadatafilter: "LicenseShortName|Artist|DateTimeOriginal|GPSLatitude|ImageDescription",
  iiurlwidth: String(DOWNLOAD_WIDTH),
};

async function fromCategory(category: string): Promise<CommonsImage[]> {
  const json = await api({ action: "query", generator: "categorymembers", gcmtitle: category, gcmtype: "file", gcmlimit: "100", ...IMAGEINFO });
  await sleep(PACE_MS);
  return toImages(json);
}

async function fromSearch(term: string): Promise<CommonsImage[]> {
  const json = await api({ action: "query", generator: "search", gsrnamespace: "6", gsrlimit: "50", gsrsearch: term, ...IMAGEINFO });
  await sleep(PACE_MS);
  return toImages(json);
}

function safeName(title: string): string {
  return title
    .replace(/^File:/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Curated mode: `npm run photos -- --curated data/curated.json`
 * Downloads exactly the reviewed photo list (title → site/phase/file), so every teammate and every
 * deployment gets the same dataset without re-running discovery.
 */
async function downloadCurated(curatedPath: string) {
  const root = path.dirname(path.resolve(curatedPath));
  const list = JSON.parse(fs.readFileSync(curatedPath, "utf8")) as Array<{ site: string; phase: string; file: string; title: string; page: string; license: string; artist: string }>;
  const pending = list.filter((e) => !fs.existsSync(path.join(root, e.file)));
  console.log(`Curated set: ${list.length} photos, ${pending.length} to download`);

  for (let i = 0; i < pending.length; i += 20) {
    const chunk = pending.slice(i, i + 20);
    const json = await api({ action: "query", titles: chunk.map((e) => `File:${e.title}`).join("|"), prop: "imageinfo", iiprop: "url", iiurlwidth: String(DOWNLOAD_WIDTH) });
    const query = json.query as { normalized?: Array<{ from: string; to: string }>; pages?: Record<string, Record<string, unknown>> } | undefined;
    const norm: Record<string, string> = {};
    for (const n of query?.normalized ?? []) norm[n.to] = n.from;
    const urls = new Map<string, { thumb: string; orig: string }>();
    for (const p of Object.values(query?.pages ?? {})) {
      const t = (norm[String(p.title)] ?? String(p.title)).replace(/^File:/, "");
      const ii = (p.imageinfo as Array<Record<string, string>> | undefined)?.[0];
      if (ii) urls.set(t, { thumb: ii.thumburl || ii.url, orig: ii.url });
    }
    for (const e of chunk) {
      const u = urls.get(e.title);
      if (!u) { console.warn(`  ✗ ${e.title}: not found on Commons`); continue; }
      try {
        let res = await fetch(u.thumb, { headers: { "User-Agent": UA } });
        if (res.status === 429 && u.orig !== u.thumb) { await sleep(5000); res = await fetch(u.orig, { headers: { "User-Agent": UA } }); }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const file = path.join(root, e.file);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        console.log(`  ✓ ${e.file}`);
        await sleep(800);
      } catch (err) {
        console.warn(`  ✗ ${e.file}: ${err instanceof Error ? err.message : err}`);
      }
    }
    await sleep(PACE_MS);
  }

  const attribution = ["# Photo attribution", "", "All photos are from Wikimedia Commons under the licence listed (CC BY, CC BY-SA, CC0, public domain or GODL-India). Keep this file with the dataset and show it in the app's credits.", ""];
  for (const e of list) attribution.push(`- \`${e.file}\` — ${e.artist} — ${e.license} — ${e.page}`);
  fs.writeFileSync(path.join(root, "ATTRIBUTION.md"), attribution.join("\n") + "\n");
  console.log(`Done. Attribution written to ${path.join(root, "ATTRIBUTION.md")}`);
}

async function main() {
  const curated = arg("curated");
  if (curated) return downloadCurated(curated);

  const manifestPath = path.resolve(arg("manifest") ?? "data/manifest.json");
  const maxOverride = arg("max") ? Number(arg("max")) : undefined;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  const root = path.dirname(manifestPath);

  const attribution: string[] = ["# Photo attribution", "", "All photos from Wikimedia Commons under the licence listed. Keep this file with the dataset.", ""];
  const used = new Set<number>();
  const index: Array<Record<string, unknown>> = [];
  let total = 0;

  for (const [site, phases] of Object.entries(manifest)) {
    for (const [phase, spec] of Object.entries(phases)) {
      const max = maxOverride ?? spec.max ?? 10;
      const dir = path.join(root, site, phase);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`\n== ${site}/${phase} (want ${max})`);

      const pool: CommonsImage[] = [];
      for (const c of spec.categories ?? []) pool.push(...(await fromCategory(c)));
      for (const s of spec.search ?? []) pool.push(...(await fromSearch(s)));

      const exclude = (spec.exclude ?? []).map((e) => e.toLowerCase());
      const seen = new Set<number>();
      const candidates = pool
        .filter((img) => !used.has(img.pageid) && !seen.has(img.pageid) && (seen.add(img.pageid), true))
        .filter((img) => !exclude.some((e) => img.title.toLowerCase().includes(e) || img.description.toLowerCase().includes(e)))
        // Prefer photos with a capture date and GPS: they exercise the timeline and site assignment.
        .sort((a, b) => Number(b.gps) - Number(a.gps) || Number(Boolean(b.dateOriginal)) - Number(Boolean(a.dateOriginal)));

      let got = 0;
      for (const img of candidates) {
        if (got >= max) break;
        const file = path.join(dir, `${safeName(img.title)}.jpg`);
        if (fs.existsSync(file)) {
          got++;
          used.add(img.pageid);
          continue;
        }
        try {
          const res = await fetch(img.thumbUrl, { headers: { "User-Agent": UA } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
          got++;
          total++;
          used.add(img.pageid);
          attribution.push(`- \`${path.relative(root, file)}\` — ${img.artist} — ${img.license} — ${img.descriptionUrl}`);
          index.push({
            site,
            phase,
            file: path.relative(root, file).replace(/\\/g, "/"),
            title: img.title.replace(/^File:/, ""),
            thumb: img.thumbUrl.replace(`/${DOWNLOAD_WIDTH}px-`, "/480px-"),
            page: img.descriptionUrl,
            license: img.license,
            artist: img.artist,
            date: img.dateOriginal,
            gps: img.gps,
            width: img.width,
            height: img.height,
            description: img.description,
          });
          console.log(`  ✓ ${path.basename(file)}  [${img.license}${img.gps ? ", GPS" : ""}${img.dateOriginal ? ", dated" : ""}]`);
          await sleep(800);
        } catch (err) {
          console.warn(`  ✗ ${img.title}: ${err instanceof Error ? err.message : err}`);
        }
      }
      if (got < max) console.warn(`  only ${got}/${max} found; add more categories or search terms for ${site}/${phase}`);
    }
  }

  fs.writeFileSync(path.join(root, "ATTRIBUTION.md"), attribution.join("\n") + "\n", { flag: fs.existsSync(path.join(root, "ATTRIBUTION.md")) ? "a" : "w" });
  const indexPath = path.join(root, "index.json");
  const previous = fs.existsSync(indexPath) ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Array<Record<string, unknown>>) : [];
  const merged = [...previous.filter((p) => !index.some((n) => n.file === p.file)), ...index];
  fs.writeFileSync(indexPath, JSON.stringify(merged, null, 2));
  console.log(`\nDownloaded ${total} new photo(s). Attribution written to ${path.join(root, "ATTRIBUTION.md")}; index at ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
