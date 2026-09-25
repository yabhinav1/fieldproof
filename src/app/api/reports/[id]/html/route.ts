import { getDb } from "@/server/db";
import { param, route } from "@/server/http";
import { getReport } from "@/server/services/reports";

export const dynamic = "force-dynamic";

/** The rendered report page. Open directly, iframe it, or print to PDF from the browser. */
export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  const report = await getReport(db, id);
  return new Response(report.html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=60" },
  });
});
