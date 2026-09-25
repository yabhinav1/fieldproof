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

async function post<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}/${path}?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Free tier is rate limited per minute; back off a few times before giving up.
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    const wait = 2000 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait));
    return post<T>(path, body, attempt + 1);
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

  const model = env.gemini.model;
  const res = await post<GenerateResponse>(`models/${model}:generateContent`, body);

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

interface BatchEmbedResponse {
  embeddings: Array<{ values: number[] }>;
}

export async function geminiEmbed(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", dimensions: number): Promise<number[][]> {
  if (!texts.length) return [];
  const model = env.gemini.embeddingModel;
  const out: number[][] = [];
  // API limit is 100 per batch; keep batches modest for the free tier.
  for (let i = 0; i < texts.length; i += 50) {
    const chunk = texts.slice(i, i + 50);
    const res = await post<BatchEmbedResponse>(`models/${model}:batchEmbedContents`, {
      requests: chunk.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: dimensions,
      })),
    });
    for (const e of res.embeddings) out.push(normalise(e.values));
  }
  return out;
}

/** Gemini embeddings are only unit-length at the full 3072 dims; renormalise so cosine works. */
function normalise(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
