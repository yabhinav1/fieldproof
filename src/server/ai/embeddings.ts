import { env } from "../env";
import { EMBEDDING_DIMENSIONS } from "../db/schema";

/**
 * Text embeddings via Voyage AI's REST API.
 * When VOYAGE_API_KEY is unset, `embedTexts` returns null and callers fall back to keyword search.
 */

export function embeddingsAvailable(): boolean {
  return Boolean(env.voyage.apiKey);
}

export type EmbeddingInputType = "document" | "query";

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage?: { total_tokens: number };
}

export async function embedTexts(texts: string[], inputType: EmbeddingInputType): Promise<number[][] | null> {
  if (!embeddingsAvailable() || texts.length === 0) return null;

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.voyage.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: env.voyage.model,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as VoyageResponse;
  const ordered = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  for (const v of ordered) {
    if (v.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding dimension mismatch: got ${v.length}, expected ${EMBEDDING_DIMENSIONS}`);
    }
  }
  return ordered;
}

export async function embedText(text: string, inputType: EmbeddingInputType): Promise<number[] | null> {
  const r = await embedTexts([text], inputType);
  return r ? r[0] : null;
}

export function embeddingModelName(): string {
  return env.voyage.model;
}
