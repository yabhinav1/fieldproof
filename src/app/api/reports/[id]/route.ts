import { getDb } from "@/server/db";
import { ok, param, route } from "@/server/http";
import { getReport } from "@/server/services/reports";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  const report = await getReport(db, id);
  const { html, ...rest } = report;
  void html;
  return ok({ ...rest, htmlUrl: `/api/reports/${report.id}/html` });
});
