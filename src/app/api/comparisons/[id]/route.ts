import { getDb } from "@/server/db";
import { ok, param, route } from "@/server/http";
import { deleteComparison, getComparison } from "@/server/services/comparisons";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  return ok(await getComparison(db, id));
});

export const DELETE = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  await deleteComparison(db, id);
  return ok({ deleted: id });
});
