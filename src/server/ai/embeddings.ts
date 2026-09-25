import { env } from "../env";
import { EMBEDDING_DIMENSIONS } from "../db/schema";
import { geminiEmbed } from "./gemini";

/**
 * Text embeddings for semantic search. Provider is chosen from configured keys
 * (Voyage AI, then Gemini). With neither, `embedTexts` returns null and search is keyword-only.
 */

export function embeddingsAvailable(): boolean {
  return env.embeddingProvider !== null;
}

export type EmbeddingInputType = "document" | "query";

export async function embedTexts(texts: string[], inputType: EmbeddingInputType): Promise<number[][] | null> {
  const provider = env.embeddingProvider;
  if (!provider || texts.length === 0) return null;

  const vectors =
    provider === "gemini"
      ? await geminiEmbed(texts, inputType === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT", EMBEDDING_DIMENSIONS)
      : await voyageEmbed(texts, inputType);

  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding dimension mismatch: got ${v.length}, expected ${EMBEDDING_DIMENSIONS}`);
    }
  }
  return vectors;
}

export async function embedText(text: string, inputType: EmbeddingInputType): Promise<number[] | null> {
  const r = await embedTexts([text], inputType);
  return r ? r[0] : null;
}

export function embeddingModelName(): string {
  return env.embeddingProvider === "gemini" ? `gemini/${env.gemini.embeddingModel}` : `voyage/${env.voyage.model}`;
}

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

async function voyageEmbed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.voyage.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: texts, model: env.voyage.model, input_type: inputType, output_dimension: EMBEDDING_DIMENSIONS }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as VoyageResponse;
  return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
