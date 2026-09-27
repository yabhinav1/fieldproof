/**
 * Seeds the demo project: Green Yamuna Collective, riverbank restoration, three sites.
 * Idempotent: re-running updates nothing if the project already exists.
 *
 *   npm run seed
 *
 * Then upload photos with `npm run upload -- --project green-yamuna --dir ./data`.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/server/db";
import { projects } from "../src/server/db/schema";
import { createProject, createSite } from "../src/server/services/projects";
import { ensureSiteLocations } from "../src/server/services/locations";

const PROJECT = {
  name: "Yamuna Riverbank Restoration",
  slug: "green-yamuna",
  orgName: "Green Yamuna Collective",
  description:
    "Six-month community programme restoring three stretches of the Yamuna riverbank in Delhi: ghat cleanup, native tree plantation, and a waste segregation drive with local vendors.",
  duringStart: new Date("2026-04-01T00:00:00Z"),
  afterStart: new Date("2026-07-15T00:00:00Z"),
};

const SITES = [
  {
    name: "Site A · Kudsia Ghat cleanup",
    description: "Removal of dumped plastic and construction debris from the ghat steps and the 300 m bank downstream.",
    lat: 28.6706,
    lng: 77.2378,
    radiusM: 1500,
  },
  {
    name: "Site B · Wazirabad plantation",
    description: "Plantation of 1,200 native saplings on the eroded floodplain north of Wazirabad barrage.",
    lat: 28.7135,
    lng: 77.2312,
    radiusM: 2000,
  },
  {
    name: "Site C · Kalindi Kunj segregation drive",
    description: "Waste segregation stations and vendor training along the Kalindi Kunj ghat approach road.",
    lat: 28.544,
    lng: 77.304,
    radiusM: 1500,
  },
];

async function main() {
  const { db, driver, close } = await createDatabase();
  console.log(`Database: ${driver}`);

  const existing = await db.query.projects.findFirst({ where: eq(projects.slug, PROJECT.slug) });
  if (existing) {
    console.log(`Project "${existing.name}" already exists (${existing.id}). Nothing to do.`);
    await close();
    return;
  }

  const project = await createProject(db, PROJECT);
  console.log(`Created project ${project.name} (${project.id})`);
  for (const s of SITES) {
    const site = await createSite(db, project.id, s);
    console.log(`  Site ${site.name} (${site.id})`);
  }
  // One default named location per site so the comparison and gallery views have something to select.
  const locations = await ensureSiteLocations(db, project.id);
  console.log(`  ${locations.size} default location(s) created`);
  await close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
