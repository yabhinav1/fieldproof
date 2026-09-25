import type { Phase } from "../db/schema";

export interface PhaseBoundaries {
  duringStart: Date | null;
  afterStart: Date | null;
}

/**
 * Assigns a phase from a capture time and the project's boundaries.
 * - No capture time: "unknown".
 * - Only afterStart set: before / after split.
 * - Only duringStart set: before / during split.
 */
export function assignPhase(capturedAt: Date | null | undefined, b: PhaseBoundaries): Phase {
  if (!capturedAt) return "unknown";
  const t = capturedAt.getTime();
  const during = b.duringStart?.getTime();
  const after = b.afterStart?.getTime();

  if (during === undefined && after === undefined) return "unknown";
  if (after !== undefined && t >= after) return "after";
  if (during !== undefined && t >= during) return "during";
  if (during !== undefined || after !== undefined) return "before";
  return "unknown";
}

export const PHASE_ORDER: Record<Phase, number> = { before: 0, during: 1, after: 2, unknown: -1 };
