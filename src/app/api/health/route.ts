import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { ok, route } from "@/server/http";
import { embeddingsAvailable } from "@/server/ai/embeddings";
import { llmAvailable } from "@/server/ai/structured";

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
      llm: llmAvailable(),
      llmProvider: env.llmProvider,
      embeddings: embeddingsAvailable(),
      embeddingProvider: env.embeddingProvider,
    },
    time: new Date().toISOString(),
  });
});
