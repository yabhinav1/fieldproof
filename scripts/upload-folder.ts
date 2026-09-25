/**
 * Bulk-uploads a folder of photos to Cloudinary and ingests them into a project.
 *
 *   npm run upload -- --project green-yamuna --dir ./data
 *   npm run upload -- --project green-yamuna --dir ./photos/siteA --site "Site A" --phase before
 *
 * Folder convention (optional): <dir>/<site folder>/<before|during|after>/*.jpg
 * When a folder name matches a site name (case-insensitive prefix, e.g. "site-a"), the site is
 * used as an override; a phase folder name overrides the phase. Otherwise GPS and EXIF decide.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createDatabase } from "../src/server/db";
import { uploadFile } from "../src/server/cloudinary";
import { env } from "../src/server/env";
import { embedPending, ingestResource } from "../src/server/services/ingest";
import { getProjectBySlugOrId, listSites, slugify } from "../src/server/services/projects";
import type { Phase } from "../src/server/db/schema";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"]);
const PHASES: Phase[] = ["before", "during", "after"];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out.sort();
}

async function main() {
  const projectKey = arg("project");
  const dir = arg("dir");
  if (!projectKey || !dir) {
    console.error("Usage: npm run upload -- --project <slug|id> --dir <folder> [--site <name>] [--phase before|during|after]");
    process.exit(1);
  }
  if (!env.cloudinary.configured) {
    console.error("Cloudinary is not configured. Fill in .env first.");
    process.exit(1);
  }

  const { db, close } = await createDatabase();
  const project = await getProjectBySlugOrId(db, projectKey);
  const siteRows = await listSites(db, project.id);

  const siteArg = arg("site");
  const phaseArg = arg("phase") as Phase | undefined;
  if (phaseArg && !PHASES.includes(phaseArg)) throw new Error(`--phase must be one of ${PHASES.join(", ")}`);

  const findSite = (name: string) => {
    const key = slugify(name);
    return siteRows.find((s) => slugify(s.name) === key || slugify(s.name).startsWith(key) || key.startsWith(slugify(s.name).split("-").slice(0, 2).join("-")));
  };
  const forcedSite = siteArg ? findSite(siteArg) : undefined;
  if (siteArg && !forcedSite) throw new Error(`No site matches "${siteArg}". Sites: ${siteRows.map((s) => s.name).join(" | ")}`);

  const files = walk(path.resolve(dir));
  console.log(`Project ${project.name}: ${files.length} image(s) under ${dir}`);

  const ingestedIds: string[] = [];
  let failed = 0;

  for (const file of files) {
    const rel = path.relative(path.resolve(dir), file);
    const parts = rel.split(path.sep);
    const folderSite = forcedSite ?? (parts.length > 1 ? findSite(parts[0]) : undefined);
    const folderPhase =
      phaseArg ?? (parts.length > 2 && PHASES.includes(parts[parts.length - 2] as Phase) ? (parts[parts.length - 2] as Phase) : undefined);

    const folder = [env.cloudinary.folder, project.slug, folderSite ? slugify(folderSite.name) : "unsorted"].join("/");

    try {
      const resource = await uploadFile(file, {
        folder,
        context: {
          project_id: project.id,
          ...(folderSite ? { site_id: folderSite.id } : {}),
          ...(folderPhase ? { phase: folderPhase } : {}),
          source_file: path.basename(file),
        },
      });
      const r = await ingestResource(db, {
        resource,
        project,
        siteRows,
        siteOverride: folderSite?.id,
        phaseOverride: folderPhase,
      });
      if (r.assetId) ingestedIds.push(r.assetId);
      const flags = r.flags?.length ? ` flags=[${r.flags.map((f) => f.code).join(",")}]` : "";
      const siteName = siteRows.find((s) => s.id === r.siteId)?.name ?? "unassigned";
      console.log(`✓ ${rel} → ${siteName} / ${r.phase}${flags}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${rel}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const embedded = await embedPending(db, ingestedIds).catch((err) => {
    console.warn(`Embeddings skipped: ${err instanceof Error ? err.message : err}`);
    return 0;
  });

  console.log(`\nIngested ${ingestedIds.length}, failed ${failed}, embedded ${embedded}.`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
