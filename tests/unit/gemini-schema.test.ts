import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toGeminiSchema } from "@/server/ai/gemini";

describe("toGeminiSchema", () => {
  it("emits the OpenAPI subset Gemini accepts and keeps enums, descriptions and nesting", () => {
    const schema = z.object({
      same_location: z.boolean().describe("Same place?"),
      confidence: z.number().min(0).max(1),
      note: z.string().nullable(),
      metrics: z.array(
        z.object({
          name: z.enum(["a", "b"]),
          direction: z.enum(["up", "down"]),
        }),
      ),
    });

    const out = toGeminiSchema(schema) as Record<string, unknown>;
    const json = JSON.stringify(out);

    expect(out.type).toBe("object");
    expect(json).not.toContain("$schema");
    expect(json).not.toContain("additionalProperties");
    expect(out.required).toEqual(["same_location", "confidence", "note", "metrics"]);
    expect(out.propertyOrdering).toEqual(["same_location", "confidence", "note", "metrics"]);

    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.same_location).toMatchObject({ type: "boolean", description: "Same place?" });
    expect(props.confidence).toMatchObject({ type: "number", minimum: 0, maximum: 1 });
    expect(props.note).toMatchObject({ type: "string", nullable: true });

    const items = (props.metrics.items as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
    expect(items.name).toMatchObject({ type: "string", enum: ["a", "b"] });
  });

  it("marks only nullable fields as nullable, keeps their description, and leaves the input alone", () => {
    const schema = z.object({
      required_text: z.string(),
      optional_note: z.string().nullable().describe("Why, if known."),
    });

    const props = toGeminiSchema(schema).properties as Record<string, Record<string, unknown>>;
    expect(props.required_text).toEqual({ type: "string" });
    expect(props.optional_note).toEqual({ type: "string", description: "Why, if known.", nullable: true });

    // Same schema twice must give the same answer: conversion does not mutate what it reads.
    expect(toGeminiSchema(schema)).toEqual(toGeminiSchema(schema));
  });
});
