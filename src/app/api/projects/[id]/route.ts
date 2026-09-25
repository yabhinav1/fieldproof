import { getDb } from "@/server/db";
import { ok, param, parseBody, route } from "@/server/http";
import { UpdateProjectSchema, deleteProject, getProjectOverview, updateProject } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  return ok(await getProjectOverview(db, id));
});

export const PATCH = route(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, UpdateProjectSchema);
  const db = await getDb();
  return ok(await updateProject(db, id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  await deleteProject(db, id);
  return ok({ deleted: id });
});
