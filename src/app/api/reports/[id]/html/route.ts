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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      // The report holds model- and user-written text. It is escaped when rendered; this makes sure
      // that even a missed case can only ever be inert markup: no scripts, no requests, no forms.
      "Content-Security-Policy":
        "default-src 'none'; img-src https://res.cloudinary.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
