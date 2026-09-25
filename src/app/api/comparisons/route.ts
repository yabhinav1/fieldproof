import { getDb } from "@/server/db";
import { created, ok, parseBody, parseQuery, route } from "@/server/http";
import { CreateComparisonSchema, ListComparisonsQuery, createComparison, listComparisons } from "@/server/services/comparisons";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = route(async (req) => {
  const q = parseQuery(req, ListComparisonsQuery);
  const db = await getDb();
  return ok(await listComparisons(db, q));
});

/** Generates a before/after comparison with an AI change assessment. */
export const POST = route(async (req) => {
  const body = await parseBody(req, CreateComparisonSchema);
  const db = await getDb();
  return created(await createComparison(db, body));
});
