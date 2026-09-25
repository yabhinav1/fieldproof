import type { ZodType } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "../env";
import { getAnthropic } from "./client";
import { geminiGenerateJson } from "./gemini";

export interface Segment {
  text?: string;
  imageUrl?: string;
}

export interface StructuredRequest<T> {
  system: string;
  /** Interleaved text and image segments, in order. */
  segments: Segment[];
  schema: ZodType<T>;
  maxTokens?: number;
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("No model provider configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY.");
    this.name = "LlmNotConfiguredError";
  }
}

export function llmAvailable(): boolean {
  return env.llmProvider !== null;
}

/**
 * One entry point for "give me JSON that matches this schema, optionally looking at these images".
 * Dispatches to Anthropic (structured outputs) or Gemini (responseSchema) based on configured keys.
 */
export async function generateStructured<T>(req: StructuredRequest<T>): Promise<{ result: T; model: string; provider: string }> {
  const provider = env.llmProvider;
  if (!provider) throw new LlmNotConfiguredError();

  if (provider === "gemini") {
    const { result, model } = await geminiGenerateJson({
      system: req.system,
      segments: req.segments.map((s) => ({ text: s.text, image: s.imageUrl ? { url: s.imageUrl } : undefined })),
      schema: req.schema,
      maxOutputTokens: req.maxTokens,
    });
    return { result, model, provider };
  }

  const client = getAnthropic();
  const content = req.segments.flatMap((s) => {
    const parts: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } }> = [];
    if (s.text) parts.push({ type: "text", text: s.text });
    if (s.imageUrl) parts.push({ type: "image", source: { type: "url", url: s.imageUrl } });
    return parts;
  });

  const response = await client.messages.parse({
    model: env.anthropic.model,
    max_tokens: req.maxTokens ?? 4000,
    system: req.system,
    output_config: { effort: "medium", format: zodOutputFormat(req.schema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Model declined the request${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ""}.`);
  }
  if (!response.parsed_output) throw new Error("Model returned no structured output.");
  return { result: response.parsed_output, model: response.model, provider };
}
