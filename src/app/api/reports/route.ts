import { z } from "zod";
import { getDb } from "@/server/db";
import { created, ok, parseBody, parseQuery, route } from "@/server/http";
import { CreateReportSchema, createReport, listReports } from "@/server/services/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = route(async (req) => {
  const { projectId } = parseQuery(req, z.object({ projectId: z.string().uuid() }));
  const db = await getDb();
  return ok(await listReports(db, projectId));
});

/** Generates a full impact report (narrative, comparisons, campaign image, HTML). */
export const POST = route(async (req) => {
  const body = await parseBody(req, CreateReportSchema);
  const db = await getDb();
  const report = await createReport(db, body);
  const { html, ...rest } = report;
  void html;
  return created({ ...rest, htmlUrl: `/api/reports/${report.id}/html` });
});
