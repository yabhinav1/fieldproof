import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { CloudinaryNotConfiguredError } from "./cloudinary";
import { AnthropicNotConfiguredError } from "./ai/client";
import { LlmNotConfiguredError } from "./ai/structured";
import { GeminiError } from "./ai/gemini";
import { env } from "./env";

/** Error carrying an HTTP status; throw it from services to get a clean JSON response. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function fail(status: number, error: string, details?: unknown) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

/** Parses and validates a JSON body; 400 on malformed JSON or schema failure. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw badRequest("Invalid request body.", flattenZod(parsed.error));
  return parsed.data;
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (obj[k] = v));
  const parsed = schema.safeParse(obj);
  if (!parsed.success) throw badRequest("Invalid query parameters.", flattenZod(parsed.error));
  return parsed.data;
}

function flattenZod(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * Wraps a route handler with uniform error mapping.
 * Usage: export const GET = route(async (req, { params }) => { ... })
 */
export function route<Ctx = { params: Promise<Record<string, string>> }>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      if (req.method === "DELETE" && env.protectDemoData) {
        throw new HttpError(403, "Deleting is turned off on this public demo.");
      }
      return await handler(req, ctx);
    } catch (err) {
      return errorToResponse(err);
    }
  };
}

export function errorToResponse(err: unknown): Response {
  if (err instanceof HttpError) return fail(err.status, err.message, err.details);
  if (err instanceof CloudinaryNotConfiguredError || err instanceof AnthropicNotConfiguredError || err instanceof LlmNotConfiguredError) {
    return fail(503, err.message);
  }
  if (err instanceof GeminiError) {
    if (err.status === 429) return fail(429, "Gemini free-tier rate limit hit; wait a minute and retry.");
    return fail(err.status >= 500 || err.status === 503 ? 503 : 502, err.message);
  }
  if (err instanceof Anthropic.RateLimitError) return fail(429, "AI provider rate limit; retry shortly.");
  if (err instanceof Anthropic.AuthenticationError) return fail(503, "AI provider rejected the API key.");
  if (err instanceof Anthropic.APIError) return fail(502, `AI provider error: ${err.message}`);

  const pg = postgresErrorCode(err);
  if (pg === "23505") return fail(409, "A record with the same unique value already exists.");
  if (pg === "23503") return fail(409, "The record references something that does not exist or is still in use.");
  if (pg === "22P02") return fail(400, "A value in the request has an invalid format.");

  console.error("[api] unhandled error", err);
  // Driver errors carry the failed SQL and its parameters; never send those to a client.
  const message = process.env.NODE_ENV === "production" ? "Internal server error." : err instanceof Error ? err.message : "Unexpected error";
  return fail(500, message);
}

/** SQLSTATE of a Postgres error. Drizzle wraps the driver error, so walk the cause chain. */
function postgresErrorCode(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 4; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves Next.js 15+/16 async route params. Every route parameter in this API is a UUID. */
export async function param(ctx: { params: Promise<Record<string, string>> }, key: string): Promise<string> {
  const p = await ctx.params;
  const v = p[key];
  if (!v) throw badRequest(`Missing route parameter ${key}`);
  if (!UUID_RE.test(v)) throw badRequest(`Route parameter ${key} must be a UUID.`);
  return v;
}
