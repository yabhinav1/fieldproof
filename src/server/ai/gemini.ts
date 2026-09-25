import { z, type ZodType } from "zod";
import { env } from "../env";

/**
 * Minimal Gemini REST client (free tier friendly): JSON-schema constrained generation with
 * images, and text embeddings. No SDK dependency; the API surface used here is small and stable.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function key(): string {
  const k = env.gemini.apiKey;
  if (!k) throw new GeminiError(503, "GEMINI_API_KEY is not set.");
  return k;
}

const isThrottle = (status: number) => status === 429 || status === 503 || status === 504;

/** Per-request wall clock. Busy free-tier models sometimes accept a request and then stall. */
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 90_000);

/** Models that recently throttled us are skipped for a while instead of re-probed on every call. */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 120_000;
export function markBusy(model: string) {
  cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
}
export function isCoolingDown(model: string) {
  return (cooldownUntil.get(model) ?? 0) > Date.now();
}

async function post<T>(path: string, body: unknown, attempt = 0, maxAttempts = 3, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}?key=${key()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Timeouts and dropped sockets behave like a busy model: retry briefly, then let callers fall back.
    const name = err instanceof Error ? err.name : "";
    const status = name === "TimeoutError" || name === "AbortError" ? 504 : 503;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      return post<T>(path, body, attempt + 1, maxAttempts, timeoutMs);
    }
    throw new GeminiError(status, `Gemini ${path} ${status === 504 ? "timed out" : "connection failed"}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Free tier is rate limited per minute and busy models return 503; back off briefly first.
  if (isThrottle(res.status) && attempt < maxAttempts - 1) {
    const wait = 1500 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait));
    return post<T>(path, body, attempt + 1, maxAttempts, timeoutMs);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(res.status, `Gemini ${path} failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

// ---------- structured generation ----------

export interface GeminiImage {
  /** Publicly fetchable URL; the image is downloaded and inlined because Gemini does not fetch URLs. */
  url: string;
  label?: string;
}

interface GenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

/**
 * Generates a JSON document that validates against `schema`.
 * Text and images are interleaved in the order given: [text0, image0, text1, image1, ...].
 */
export async function geminiGenerateJson<T>(opts: {
  system: string;
  segments: Array<{ text?: string; image?: GeminiImage }>;
  schema: ZodType<T>;
  maxOutputTokens?: number;
}): Promise<{ result: T; model: string }> {
  const parts: Array<Record<string, unknown>> = [];
  for (const seg of opts.segments) {
    if (seg.text) parts.push({ text: seg.text });
    if (seg.image) {
      const { data, mimeType } = await fetchAsBase64(seg.image.url);
      parts.push({ inline_data: { mime_type: mimeType, data } });
    }
  }

  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(opts.schema),
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      temperature: 0.2,
    },
  };

  // Try the primary model, then fall back down the chain when a model is throttled, busy or stalled.
  // Models that failed recently are skipped for a couple of minutes so users don't pay the probe cost each call.
  const fullChain = [env.gemini.model, ...env.gemini.fallbackModels.filter((m) => m !== env.gemini.model)];
  const chain = fullChain.filter((m) => !isCoolingDown(m));
  const candidates = chain.length ? chain : [fullChain[fullChain.length - 1]];
  let res: GenerateResponse | undefined;
  let model = candidates[0];
  let lastErr: unknown;
  for (let i = 0; i < candidates.length; i++) {
    model = candidates[i];
    const isLast = i === candidates.length - 1;
    try {
      // Non-final models get one attempt and a shorter clock so a stall costs seconds, not minutes.
      res = await post<GenerateResponse>(`models/${model}:generateContent`, body, 0, isLast ? 3 : 1, isLast ? REQUEST_TIMEOUT_MS : Math.min(REQUEST_TIMEOUT_MS, 45_000));
      break;
    } catch (err) {
      lastErr = err;
      if (err instanceof GeminiError && isThrottle(err.status) && !isLast) {
        markBusy(model);
        console.warn(`[gemini] ${model} unavailable (${err.status}); falling back to ${candidates[i + 1]}`);
        continue;
      }
      throw err;
    }
  }
  if (!res) throw lastErr instanceof Error ? lastErr : new GeminiError(503, "All Gemini models are busy.");

  if (res.promptFeedback?.blockReason) {
    throw new GeminiError(502, `Gemini blocked the request: ${res.promptFeedback.blockReason}`);
  }
  const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new GeminiError(502, `Gemini returned no content (finishReason=${res.candidates?.[0]?.finishReason ?? "unknown"}).`);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GeminiError(502, "Gemini returned invalid JSON.");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new GeminiError(502, `Gemini output failed validation: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
  }
  return { result: parsed.data, model: res.modelVersion ?? model };
}

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new GeminiError(502, `Could not fetch image for analysis (${res.status}): ${url}`);
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mimeType };
}

/**
 * Converts a Zod schema to the OpenAPI-style subset Gemini's `responseSchema` accepts.
 * Drops keys Gemini rejects ($schema, additionalProperties, etc.) and keeps descriptions.
 */
export function toGeminiSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  return clean(json) as Record<string, unknown>;
}

const ALLOWED = new Set(["type", "format", "description", "nullable", "enum", "items", "properties", "required", "minimum", "maximum", "minItems", "maxItems", "propertyOrdering"]);

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const src = node as Record<string, unknown>;

  // anyOf [X, null] → X with nullable
  if (Array.isArray(src.anyOf)) {
    const nonNull = (src.anyOf as Array<Record<string, unknown>>).filter((s) => s.type !== "null");
    if (nonNull.length === 1) return { ...(clean(nonNull[0]) as Record<string, unknown>), nullable: true };
  }
  if (Array.isArray(src.type)) {
    const types = (src.type as string[]).filter((t) => t !== "null");
    src.type = types[0];
    if (types.length !== (src.type as unknown as string[]).length) src.nullable = true;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!ALLOWED.has(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) props[pk] = clean(pv);
      out.properties = props;
      // Gemini honours propertyOrdering; keep declaration order for readable output.
      out.propertyOrdering = Object.keys(props);
    } else if (k === "items") {
      out.items = clean(v);
    } else {
      out[k] = v;
    }
  }
  if (out.type === "integer") out.type = "integer";
  return out;
}

// ---------- embeddings ----------

interface EmbedResponse {
  embedding: { values: number[] };
}

/**
 * Embeds texts one request each with a small concurrency cap. The single-item endpoint is the
 * one every embedding model generation supports; free-tier limits are per minute, so we stay gentle.
 */
export async function geminiEmbed(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", dimensions: number): Promise<number[][]> {
  if (!texts.length) return [];
  const model = env.gemini.embeddingModel;
  const out: number[][] = new Array(texts.length);
  const CONCURRENCY = 4;
  let next = 0;

  async function worker() {
    while (next < texts.length) {
      const i = next++;
      const res = await post<EmbedResponse>(`models/${model}:embedContent`, {
        model: `models/${model}`,
        content: { parts: [{ text: texts[i] }] },
        taskType,
        outputDimensionality: dimensions,
      });
      out[i] = normalise(res.embedding.values);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));
  return out;
}

/** Gemini embeddings are only unit-length at the full 3072 dims; renormalise so cosine works. */
function normalise(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
