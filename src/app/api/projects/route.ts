import { getDb } from "@/server/db";
import { created, ok, parseBody, route } from "@/server/http";
import { CreateProjectSchema, createProject, listProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const db = await getDb();
  return ok(await listProjects(db));
});

export const POST = route(async (req) => {
  const body = await parseBody(req, CreateProjectSchema);
  const db = await getDb();
  return created(await createProject(db, body));
});
