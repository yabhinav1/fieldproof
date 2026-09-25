import { z } from "zod";
import { generateStructured } from "./structured";
import type { ComparisonMetric } from "../db/schema";

export const METRIC_NAMES = [
  "vegetation_cover",
  "waste_and_debris",
  "water_clarity",
  "human_activity",
  "infrastructure",
] as const;

const ComparisonSchema = z.object({
  same_location: z.boolean().describe("Whether both photos plausibly show the same place."),
  location_confidence: z.number().min(0).max(1).describe("Confidence that it is the same place, 0 to 1."),
  headline: z.string().describe("At most 10 words, suitable as a report or social caption."),
  summary: z.string().describe("About 60 words, neutral NGO impact-report tone, only what is visible."),
  metrics: z
    .array(
      z.object({
        name: z.enum(METRIC_NAMES),
        direction: z.enum(["decreased", "unchanged", "increased", "not_visible"]),
        reason: z.string().describe("One sentence grounded in visible evidence."),
      }),
    )
    .describe("Exactly one entry per metric name."),
});

export type ComparisonResult = z.infer<typeof ComparisonSchema>;

const SYSTEM_PROMPT = `You compare two field photographs for a sustainability impact report. The first image is the BEFORE state and the second is the AFTER state of the same project site.

Describe only what is visible. Do not speculate about causes, dates, or people's intentions. If the two photos clearly do not show the same place, say so and set same_location to false; still fill in every metric using "not_visible" where a comparison is impossible.

Rate each metric relative to the BEFORE image:
- vegetation_cover: plants, trees, grass, canopy.
- waste_and_debris: litter, dumped material, construction rubble.
- water_clarity: visible water bodies; "not_visible" if none.
- human_activity: people working, volunteers, visitors.
- infrastructure: paths, bins, fences, signage, planting beds, structures.

Write for a donor or government reader: plain, specific, and free of marketing language.`;

export interface CompareInput {
  beforeUrl: string;
  afterUrl: string;
  siteName?: string;
  projectName?: string;
}

/** Runs the vision comparison through whichever provider is configured. */
export async function compareImages(input: CompareInput): Promise<{ result: ComparisonResult; model: string }> {
  const context = [input.projectName && `Project: ${input.projectName}`, input.siteName && `Site: ${input.siteName}`]
    .filter(Boolean)
    .join("\n");

  const { result, model, provider } = await generateStructured({
    system: SYSTEM_PROMPT,
    schema: ComparisonSchema,
    maxTokens: 4000,
    segments: [
      { text: `${context ? context + "\n\n" : ""}BEFORE:`, imageUrl: input.beforeUrl },
      { text: "AFTER:", imageUrl: input.afterUrl },
      { text: "Compare the two photos and fill in the structured result." },
    ],
  });

  return { result: normalise(result), model: `${provider}/${model}` };
}

/** Guarantees exactly one entry per metric, in canonical order. */
function normalise(r: ComparisonResult): ComparisonResult {
  const byName = new Map(r.metrics.map((m) => [m.name, m]));
  const metrics = METRIC_NAMES.map(
    (name) => byName.get(name) ?? { name, direction: "not_visible" as const, reason: "Not assessed." },
  );
  return { ...r, metrics };
}

export function toStoredMetrics(r: ComparisonResult): ComparisonMetric[] {
  return r.metrics.map((m) => ({ name: m.name, direction: m.direction, reason: m.reason }));
}
