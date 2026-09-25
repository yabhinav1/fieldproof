/**
 * Re-runs Cloudinary analysis (tags, caption, EXIF, phash) on assets that are missing AI results,
 * for example after an add-on quota reset. Manual site/phase decisions are preserved.
 *
 *   npm run reanalyze -- --project green-yamuna            # assets with no caption
 *   npm run reanalyze -- --project green-yamuna --all      # every asset
 */
import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { createDatabase } from "../src/server/db";
import { assets } from "../src/server/db/schema";
import { ingestAssets } from "../src/server/services/ingest";
import { getProjectBySlugOrId } from "../src/server/services/projects";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const key = arg("project");
  if (!key) {
    console.error("Usage: npm run reanalyze -- --project <slug|id> [--all]");
    process.exit(1);
  }
  const all = process.argv.includes("--all");
  const { db, close } = await createDatabase();
  const project = await getProjectBySlugOrId(db, key);

  const rows = await db
    .select({ publicId: assets.cloudinaryPublicId })
    .from(assets)
    .where(all ? eq(assets.projectId, project.id) : and(eq(assets.projectId, project.id), isNull(assets.aiCaption)));
  console.log(`${rows.length} asset(s) to re-analyse in ${project.name}`);
  if (!rows.length) return close();

  const results = await ingestAssets(db, { projectId: project.id, publicIds: rows.map((r) => r.publicId), analyze: true });
  for (const r of results) console.log(`${r.status === "failed" ? "✗" : "✓"} ${r.publicId}${r.error ? " " + r.error : ""}`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
