import { z } from "zod";
import { getDb } from "@/server/db";
import { ok, parseBody, route } from "@/server/http";
import { signUpload } from "@/server/cloudinary";
import { getProject, getSite, slugify } from "@/server/services/projects";

export const dynamic = "force-dynamic";

const Body = z.object({
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
});

/**
 * Returns a signature for a direct browser upload to Cloudinary.
 * The frontend sends `params` unchanged plus `api_key`, `signature` and the file.
 * After upload, POST the returned public_id(s) to /api/assets/ingest.
 */
export const POST = route(async (req) => {
  const body = await parseBody(req, Body);
  const db = await getDb();
  const project = await getProject(db, body.projectId);
  const site = body.siteId ? await getSite(db, body.siteId) : null;

  const signed = signUpload({
    projectSlug: project.slug,
    siteSlug: site ? slugify(site.name) : undefined,
    context: { project_id: project.id, ...(site ? { site_id: site.id } : {}) },
  });
  return ok(signed);
});
