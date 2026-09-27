/**
 * Gives every site in a project a default named location and attaches assets that have none.
 * Run once after upgrading to the locations feature, or after seeding a project.
 *
 *   npm run backfill:locations -- --project green-yamuna
 */
import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { createDatabase } from "../src/server/db";
import { assets } from "../src/server/db/schema";
import { ensureSiteLocations } from "../src/server/services/locations";
import { getProjectBySlugOrId } from "../src/server/services/projects";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const key = arg("project");
  if (!key) {
    console.error("Usage: npm run backfill:locations -- --project <slug|id>");
    process.exit(1);
  }
  const { db, close } = await createDatabase();
  const project = await getProjectBySlugOrId(db, key);
  const map = await ensureSiteLocations(db, project.id);
  console.log(`${map.size} site location(s) ensured for ${project.name}`);

  let attached = 0;
  for (const [siteId, locationId] of map) {
    const rows = await db
      .update(assets)
      .set({ locationId })
      .where(and(eq(assets.projectId, project.id), eq(assets.siteId, siteId), isNull(assets.locationId)))
      .returning();
    attached += rows.length;
  }
  console.log(`Attached ${attached} asset(s) to their site's default location.`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
