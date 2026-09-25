import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, modelId } from "./client";

const NarrativeSchema = z.object({
  title: z.string().describe("Report title, at most 12 words."),
  executive_summary: z.string().describe("120 to 180 words for a donor or government reader."),
  key_numbers: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("3 to 6 headline figures taken only from the supplied facts."),
  sites: z.array(
    z.object({
      site_id: z.string(),
      narrative: z.string().describe("60 to 100 words about what changed at this site, grounded in the evidence."),
    }),
  ),
  call_to_action: z.string().describe("One or two sentences inviting continued support."),
  campaign_headline: z.string().describe("At most 8 words for a social media image."),
});

export type NarrativeResult = z.infer<typeof NarrativeSchema>;

const SYSTEM_PROMPT = `You write impact reports for NGOs and sustainability organisations from structured field evidence.

Rules:
- Use only the facts supplied. Never invent numbers, dates, names, or outcomes.
- Each site narrative must reference what the before/after comparison and photo captions actually show.
- Tone: factual, warm, specific. No superlatives, no exclamation marks.
- If evidence for a site is thin, say so plainly rather than padding.`;

export interface NarrativeFacts {
  project: { name: string; description: string | null; orgName: string | null };
  period: { from: string | null; to: string | null };
  totals: { assets: number; verified: number; flagged: number; sites: number; comparisons: number };
  sites: Array<{
    id: string;
    name: string;
    description: string | null;
    assetCounts: { before: number; during: number; after: number; unknown: number };
    topTags: string[];
    sampleCaptions: string[];
    comparison: null | {
      headline: string | null;
      summary: string | null;
      metrics: Array<{ name: string; direction: string; reason: string }>;
    };
  }>;
}

export async function writeNarrative(facts: NarrativeFacts): Promise<{ result: NarrativeResult; model: string }> {
  const client = getAnthropic();

  const response = await client.messages.parse({
    model: modelId(),
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "medium", format: zodOutputFormat(NarrativeSchema) },
    messages: [
      {
        role: "user",
        content: `Write the impact report from these facts.\n\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model declined to write this report.");
  }
  if (!response.parsed_output) {
    throw new Error("Model returned no structured narrative.");
  }
  return { result: response.parsed_output, model: response.model };
}
