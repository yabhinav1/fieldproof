import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { CloudinaryNotConfiguredError } from "./cloudinary";
import { AnthropicNotConfiguredError } from "./ai/client";

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
      return await handler(req, ctx);
    } catch (err) {
      return errorToResponse(err);
    }
  };
}

export function errorToResponse(err: unknown): Response {
  if (err instanceof HttpError) return fail(err.status, err.message, err.details);
  if (err instanceof CloudinaryNotConfiguredError || err instanceof AnthropicNotConfiguredError) {
    return fail(503, err.message);
  }
  if (err instanceof Anthropic.RateLimitError) return fail(429, "AI provider rate limit; retry shortly.");
  if (err instanceof Anthropic.AuthenticationError) return fail(503, "AI provider rejected the API key.");
  if (err instanceof Anthropic.APIError) return fail(502, `AI provider error: ${err.message}`);

  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[api] unhandled error", err);
  return fail(500, message);
}

/** Resolves Next.js 15+/16 async route params. */
export async function param(ctx: { params: Promise<Record<string, string>> }, key: string): Promise<string> {
  const p = await ctx.params;
  const v = p[key];
  if (!v) throw badRequest(`Missing route parameter ${key}`);
  return v;
}
