import { getDb } from "@/server/db";
import { ok, param, parseBody, route } from "@/server/http";
import { UpdateAssetSchema, deleteAsset, getAssetDetail, updateAsset } from "@/server/services/assets";

export const dynamic = "force-dynamic";

/** Asset detail including the full provenance panel payload. */
export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  return ok(await getAssetDetail(db, id));
});

/** Manual corrections: reassign site, override phase, mark verified. */
export const PATCH = route(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, UpdateAssetSchema);
  const db = await getDb();
  return ok(await updateAsset(db, id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  await deleteAsset(db, id);
  return ok({ deleted: id });
});
