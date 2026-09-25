import { z } from "zod";
import { generateStructured, llmAvailable } from "./structured";

const DescribeSchema = z.object({
  caption: z.string().describe("One factual sentence describing what the photo shows, 12 to 25 words."),
  tags: z.array(z.string()).describe("5 to 12 lowercase tags: objects, materials, setting, activity."),
});

const SYSTEM_PROMPT = `You label field photographs for an environmental NGO's evidence archive. Describe only what is visible: objects, materials, setting, people's activities. No judgement, no guessing about place names or dates. Tags are single lowercase words or short phrases.`;

export interface ImageDescription {
  caption: string;
  tags: string[];
  model: string;
}

/**
 * Vision-model fallback for captions and tags when Cloudinary's add-ons return nothing
 * (quota exhausted, add-on not enabled, or an asset it declines to analyse).
 */
export async function describeImage(imageUrl: string): Promise<ImageDescription | null> {
  if (!llmAvailable()) return null;
  const { result, model, provider } = await generateStructured({
    system: SYSTEM_PROMPT,
    schema: DescribeSchema,
    maxTokens: 1000,
    segments: [{ text: "Describe this photo for the archive.", imageUrl }],
  });
  const tags = [...new Set(result.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  return { caption: result.caption.trim(), tags, model: `${provider}/${model}` };
}
