import { getDb } from "@/server/db";
import { ok, param, route } from "@/server/http";
import { deleteReport, getReport } from "@/server/services/reports";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  const report = await getReport(db, id);
  const { html, ...rest } = report;
  void html;
  return ok({ ...rest, htmlUrl: `/api/reports/${report.id}/html` });
});

/** Removes the report and the provenance rows it created. Source assets are untouched. */
export const DELETE = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  await deleteReport(db, id);
  return ok({ deleted: id });
});
