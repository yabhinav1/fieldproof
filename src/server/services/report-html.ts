import type { ComparisonMetric, Phase, ReportContent } from "../db/schema";

export interface ReportRenderData {
  project: { name: string; orgName: string | null; description: string | null };
  content: ReportContent;
  heroUrl: string | null;
  campaignImageUrl: string | null;
  period: { from: string | null; to: string | null };
  totals: { assets: number; verified: number; flagged: number; sites: number; comparisons: number };
  sites: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    comparison: null | {
      beforeUrl: string;
      afterUrl: string;
      headline: string | null;
      summary: string | null;
      metrics: ComparisonMetric[];
    };
    gallery: Array<{ id: string; url: string; caption: string | null; phase: Phase; capturedAt: string | null; publicId: string }>;
  }>;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const METRIC_LABEL: Record<string, string> = {
  vegetation_cover: "Vegetation cover",
  waste_and_debris: "Waste and debris",
  water_clarity: "Water clarity",
  human_activity: "Human activity",
  infrastructure: "Infrastructure",
};

const DIRECTION_LABEL: Record<string, string> = {
  increased: "▲ Increased",
  decreased: "▼ Decreased",
  unchanged: "— Unchanged",
  not_visible: "· Not visible",
};

/**
 * Self-contained, print-friendly HTML. The frontend can iframe it, link to it,
 * or let the browser print it to PDF. No external scripts.
 */
export function renderReportHtml(d: ReportRenderData): string {
  const c = d.content;
  const period = d.period.from && d.period.to ? `${d.period.from} to ${d.period.to}` : "Period not available";

  const sitesHtml = d.sites
    .map((s) => {
      const narrative = c.sites.find((x) => x.siteId === s.id)?.narrative ?? "";
      const cmp = s.comparison
        ? `
        <div class="compare">
          <figure><img src="${esc(s.comparison.beforeUrl)}" alt="Before, ${esc(s.name)}"><figcaption>Before</figcaption></figure>
          <figure><img src="${esc(s.comparison.afterUrl)}" alt="After, ${esc(s.name)}"><figcaption>After</figcaption></figure>
        </div>
        ${s.comparison.headline ? `<p class="headline">${esc(s.comparison.headline)}</p>` : ""}
        ${s.comparison.summary ? `<p>${esc(s.comparison.summary)}</p>` : ""}
        <ul class="metrics">
          ${s.comparison.metrics
            .map((m) => `<li><span class="m-name">${esc(METRIC_LABEL[m.name] ?? m.name)}</span><span class="m-dir ${esc(m.direction)}">${esc(DIRECTION_LABEL[m.direction] ?? m.direction)}</span><span class="m-reason">${esc(m.reason)}</span></li>`)
            .join("")}
        </ul>`
        : `<p class="muted">No before/after comparison has been generated for this site yet.</p>`;

      const gallery = s.gallery.length
        ? `<div class="gallery">${s.gallery
            .map(
              (g) =>
                `<figure><img src="${esc(g.url)}" alt="${esc(g.caption ?? s.name)}" loading="lazy"><figcaption>${esc(g.phase)}${g.capturedAt ? " · " + esc(g.capturedAt.slice(0, 10)) : ""}</figcaption></figure>`,
            )
            .join("")}</div>`
        : "";

      return `
      <section class="site">
        <h2>${esc(s.name)}</h2>
        <p class="coords">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</p>
        ${narrative ? `<p>${esc(narrative)}</p>` : ""}
        ${cmp}
        ${gallery}
      </section>`;
    })
    .join("");

  const sources = d.sites
    .flatMap((s) => s.gallery.map((g) => `<li><code>${esc(g.publicId)}</code> — ${esc(s.name)}, ${esc(g.phase)}</li>`))
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<style>
  :root { --ink:#1a1a1a; --muted:#5b6b64; --brand:#0b3d2e; --accent:#1f8a5b; --line:#d9e2dd; --bg:#fff; }
  @media (prefers-color-scheme: dark) { :root { --ink:#e8ede9; --muted:#9fb0a7; --brand:#bfe3d0; --accent:#4ec28a; --line:#2b3a33; --bg:#0f1512; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 32px 16px 64px; }
  .kicker { color:var(--accent); letter-spacing:.14em; text-transform:uppercase; font-size:12px; font-weight:600; }
  h1 { margin:.2em 0 .3em; font-size: clamp(28px, 5vw, 40px); color:var(--brand); line-height:1.15; }
  h2 { margin:1.6em 0 .3em; font-size:22px; color:var(--brand); }
  .meta, .coords, .muted { color:var(--muted); font-size:14px; }
  .hero { width:100%; border-radius:10px; margin: 20px 0; display:block; }
  .numbers { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap:12px; margin: 20px 0; }
  .num { border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
  .num b { display:block; font-size:22px; color:var(--brand); }
  .num span { font-size:13px; color:var(--muted); }
  .compare { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin: 14px 0 8px; }
  .compare figure, .gallery figure { margin:0; }
  .compare img, .gallery img { width:100%; height:auto; border-radius:8px; display:block; border:1px solid var(--line); }
  figcaption { font-size:12px; color:var(--muted); margin-top:4px; }
  .headline { font-weight:600; margin:.6em 0 .2em; }
  .metrics { list-style:none; padding:0; margin: 10px 0 0; display:grid; gap:6px; }
  .metrics li { display:grid; grid-template-columns: 150px 120px 1fr; gap:10px; font-size:14px; align-items:baseline; }
  .m-dir.increased { color:var(--accent); font-weight:600; } .m-dir.decreased { color:#b45309; font-weight:600; } .m-dir.unchanged, .m-dir.not_visible { color:var(--muted); }
  .gallery { display:grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap:10px; margin-top:14px; }
  .cta { border-left:4px solid var(--accent); padding:10px 16px; margin:32px 0; background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .campaign { max-width: 360px; border-radius:10px; border:1px solid var(--line); display:block; }
  .sources { font-size:13px; color:var(--muted); }
  .sources code { font-size:12px; }
  @media (max-width: 600px) { .metrics li { grid-template-columns: 1fr; gap:2px; } .compare { grid-template-columns:1fr; } }
  @media print { .wrap { padding:0; } .site { break-inside: avoid; } a { color:inherit; text-decoration:none; } }
</style>
</head>
<body>
<main class="wrap">
  <div class="kicker">${esc(d.project.orgName ?? "Impact report")}</div>
  <h1>${esc(c.title)}</h1>
  <p class="meta">${esc(d.project.name)} · ${esc(period)} · ${d.totals.sites} sites · ${d.totals.verified} verified photos</p>
  ${d.heroUrl ? `<img class="hero" src="${esc(d.heroUrl)}" alt="${esc(d.project.name)}">` : ""}

  <p>${esc(c.executiveSummary)}</p>

  <div class="numbers">
    ${c.keyNumbers.map((k) => `<div class="num"><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join("")}
  </div>

  ${sitesHtml}

  <div class="cta">${esc(c.callToAction)}</div>

  ${d.campaignImageUrl ? `<h2>Campaign image</h2><img class="campaign" src="${esc(d.campaignImageUrl)}" alt="Campaign image">` : ""}

  <h2>Evidence sources</h2>
  <p class="sources">Every image in this report is derived from an original Cloudinary asset listed below. Transformations are recorded per image and can be inspected in the platform's provenance panel.</p>
  <ul class="sources">${sources}</ul>
  <p class="meta">Generated ${esc(c.generatedAt.slice(0, 16).replace("T", " "))} UTC · ${d.totals.flagged} photo(s) excluded pending verification</p>
</main>
</body>
</html>`;
}
