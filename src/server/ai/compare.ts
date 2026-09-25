import { z } from "zod";
import { generateStructured } from "./structured";
import type { ComparisonMetric, ComparisonMode } from "../db/schema";

export const METRIC_NAMES = [
  "vegetation_cover",
  "waste_and_debris",
  "water_clarity",
  "human_activity",
  "infrastructure",
] as const;

const ComparisonSchema = z.object({
  same_location: z.boolean().describe("Whether both photos plausibly show the same place from a similar vantage point."),
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

const METRIC_GUIDE = `Rate each metric for the AFTER photo relative to the BEFORE photo:
- vegetation_cover: plants, trees, grass, canopy.
- waste_and_debris: litter, dumped material, construction rubble.
- water_clarity: visible water bodies; "not_visible" if neither photo shows water.
- human_activity: people working, volunteers, visitors.
- infrastructure: paths, bins, fences, signage, planting beds, structures.

Write for a donor or government reader: plain, specific, and free of marketing language. Describe only what is visible; do not speculate about causes, dates, or intentions.`;

const SAME_SPOT_PROMPT = `You compare two field photographs for a sustainability impact report. The first image is the BEFORE state and the second is the AFTER state of the same project site, ideally taken from the same vantage point.

If the two photos clearly do not show the same place, set same_location to false and use "not_visible" for every metric; say so plainly in the summary.

${METRIC_GUIDE}`;

const REPRESENTATIVE_PROMPT = `You compare two field photographs for a sustainability impact report. Both photos come from the same project site. The first is a representative photo of the site BEFORE the intervention and the second a representative photo AFTER it. They were not necessarily taken from the same vantage point, and that is expected: field teams often lack exact repeat photography.

Still report same_location honestly (true only if it looks like the same vantage point), but ALWAYS fill in every metric by comparing the conditions the two photos depict. In the summary, describe the change in conditions and, in one clause, note that the photos are representative rather than a fixed-point pair.

${METRIC_GUIDE}`;

export interface CompareInput {
  beforeUrl: string;
  afterUrl: string;
  mode: ComparisonMode;
  siteName?: string;
  projectName?: string;
}

/** Runs the vision comparison through whichever provider is configured. */
export async function compareImages(input: CompareInput): Promise<{ result: ComparisonResult; model: string }> {
  const context = [input.projectName && `Project: ${input.projectName}`, input.siteName && `Site: ${input.siteName}`]
    .filter(Boolean)
    .join("\n");

  const { result, model, provider } = await generateStructured({
    system: input.mode === "representative" ? REPRESENTATIVE_PROMPT : SAME_SPOT_PROMPT,
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
