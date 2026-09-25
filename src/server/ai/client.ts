import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

let client: Anthropic | null = null;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. AI comparisons and report narratives need it.");
    this.name = "AnthropicNotConfiguredError";
  }
}

export function aiAvailable(): boolean {
  return Boolean(env.anthropic.apiKey);
}

export function getAnthropic(): Anthropic {
  if (!aiAvailable()) throw new AnthropicNotConfiguredError();
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropic.apiKey, maxRetries: 2, timeout: 120_000 });
  }
  return client;
}

export function modelId(): string {
  return env.anthropic.model;
}
