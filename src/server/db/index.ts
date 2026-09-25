import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type Database =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

interface DbHandle {
  db: Database;
  driver: "postgres" | "pglite";
  close: () => Promise<void>;
}

const globalForDb = globalThis as unknown as { __fieldproofDb?: Promise<DbHandle> };

/**
 * Creates a fresh database handle.
 *
 * - With DATABASE_URL set: connects to Postgres (Neon, Supabase, local) via postgres.js.
 * - Without it: boots an embedded PGlite database. `dataDir` controls persistence
 *   (defaults to ./.pglite so local dev data survives restarts; pass "memory://" for tests).
 *
 * Migrations from ./drizzle run on every open, so a fresh database is ready to use.
 */
export async function createDatabase(opts: { dataDir?: string; url?: string } = {}): Promise<DbHandle> {
  const url = opts.url ?? process.env.DATABASE_URL;

  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare:false keeps us compatible with transaction-mode poolers (Neon pooler, PgBouncer).
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzlePg(client, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return { db, driver: "postgres", close: () => client.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const dataDir = opts.dataDir ?? process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".pglite");
  const client = await PGlite.create({ dataDir, extensions: { vector } });
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, driver: "pglite", close: () => client.close() };
}

/** Process-wide shared handle, cached across Next.js hot reloads. */
export function getDb(): Promise<Database> {
  if (!globalForDb.__fieldproofDb) {
    globalForDb.__fieldproofDb = createDatabase();
  }
  return globalForDb.__fieldproofDb.then((h) => h.db);
}

export { schema };
