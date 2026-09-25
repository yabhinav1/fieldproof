import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { ok, route } from "@/server/http";
import { aiAvailable } from "@/server/ai/client";
import { embeddingsAvailable } from "@/server/ai/embeddings";

export const dynamic = "force-dynamic";

/** Readiness probe. Tells the frontend which optional integrations are live. */
export const GET = route(async () => {
  const db = await getDb();
  await db.execute(sql`select 1`);
  return ok({
    status: "ok",
    database: env.databaseUrl ? "postgres" : "pglite",
    integrations: {
      cloudinary: env.cloudinary.configured,
      cloudinaryAutoTagging: env.cloudinary.autoTagging || null,
      cloudinaryCaptioning: env.cloudinary.captioning,
      anthropic: aiAvailable(),
      embeddings: embeddingsAvailable(),
    },
    time: new Date().toISOString(),
  });
});
