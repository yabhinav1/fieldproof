import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

let client: Anthropic | null = null;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set.");
    this.name = "AnthropicNotConfiguredError";
  }
}

export function getAnthropic(): Anthropic {
  if (!env.anthropic.apiKey) throw new AnthropicNotConfiguredError();
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropic.apiKey, maxRetries: 2, timeout: 120_000 });
  }
  return client;
}
