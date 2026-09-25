/**
 * DEMO FIXTURE. Assigns plausible capture dates to assets that have none, spread evenly inside
 * each project's phase windows (before < duringStart <= during < afterStart <= after).
 *
 * Why: the demo photo set is openly licensed stock from Wikimedia Commons; the files lose EXIF when
 * downloaded at web size, and their real dates span 2005–2026 anyway. Reports and timelines need
 * dates inside the fictional programme's window. Only assets with `captured_at IS NULL` or whose
 * date is outside the window are touched, and the change is recorded in `flags` as `demo_date`.
 *
 *   npm run demo:dates -- --project green-yamuna
 */
import "dotenv/config";
import { and, asc, eq } from "drizzle-orm";
import { createDatabase } from "../src/server/db";
import { assets, type AssetFlag } from "../src/server/db/schema";
import { getProjectBySlugOrId, listSites } from "../src/server/services/projects";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DAY = 86_400_000;

async function main() {
  const key = arg("project");
  if (!key) {
    console.error("Usage: npm run demo:dates -- --project <slug|id>");
    process.exit(1);
  }
  const { db, close } = await createDatabase();
  const project = await getProjectBySlugOrId(db, key);
  if (!project.duringStart || !project.afterStart) throw new Error("Project needs duringStart and afterStart to define phase windows.");

  const during = project.duringStart.getTime();
  const after = project.afterStart.getTime();
  const windows = {
    before: [during - 120 * DAY, during - 3 * DAY],
    during: [during + 2 * DAY, after - 3 * DAY],
    after: [after + 2 * DAY, Math.min(Date.now(), after + 120 * DAY)],
  } as const;

  const sites = await listSites(db, project.id);
  let updated = 0;
  for (const site of [...sites, null]) {
    for (const phase of ["before", "during", "after"] as const) {
      const rows = await db
        .select()
        .from(assets)
        .where(and(eq(assets.projectId, project.id), site ? eq(assets.siteId, site.id) : eq(assets.phase, phase), eq(assets.phase, phase)))
        .orderBy(asc(assets.createdAt));
      const [start, end] = windows[phase];
      const n = rows.length;
      for (let i = 0; i < n; i++) {
        const a = rows[i];
        const inWindow = a.capturedAt && a.capturedAt.getTime() >= start && a.capturedAt.getTime() <= end;
        // An in-window date that only came from the upload timestamp (no EXIF) still gets spread out.
        const uploadDateOnly = a.flags.some((f) => f.code === "no_capture_date");
        if (inWindow && !uploadDateOnly) continue;
        // Spread evenly through the window, at a consistent 10:30 local-ish time.
        const t = start + ((end - start) * (i + 1)) / (n + 1);
        const d = new Date(t);
        d.setUTCHours(5, 0, 0, 0); // 10:30 IST
        const flags: AssetFlag[] = [
          ...a.flags.filter((f) => f.code !== "no_capture_date" && f.code !== "demo_date"),
          { code: "demo_date", message: "Capture date is a demo fixture assigned inside the phase window (source photo had no EXIF)." },
        ];
        await db.update(assets).set({ capturedAt: d, flags, updatedAt: new Date() }).where(eq(assets.id, a.id));
        updated++;
      }
    }
  }
  console.log(`Assigned demo capture dates to ${updated} asset(s) in ${project.name}.`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
