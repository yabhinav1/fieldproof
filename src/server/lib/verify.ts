import type { AssetFlag, Phase } from "../db/schema";
import { DUPLICATE_THRESHOLD, hammingDistance, isValidPhash } from "./phash";
import { PHASE_ORDER } from "./phase";

export interface VerifyInput {
  capturedAt: Date | null;
  hasGps: boolean;
  siteMatched: boolean;
  distanceToSiteM: number | null;
  siteRadiusM: number | null;
  phase: Phase;
  phash: string | null;
  /** Other assets in the same project, used for duplicate and phase-order checks. */
  peers: Array<{ id: string; phash: string | null; phase: Phase; capturedAt: Date | null; siteId: string | null }>;
  siteId: string | null;
  now?: Date;
}

/**
 * Cheap integrity checks that make the evidence trustworthy.
 * Returns an empty list when everything looks consistent.
 */
export function verifyAsset(input: VerifyInput): AssetFlag[] {
  const flags: AssetFlag[] = [];
  const now = input.now ?? new Date();

  if (!input.capturedAt) {
    flags.push({ code: "no_capture_date", message: "No EXIF capture date; phase was not inferred." });
  } else if (input.capturedAt.getTime() > now.getTime() + 24 * 3600 * 1000) {
    flags.push({ code: "future_date", message: "EXIF capture date is in the future.", value: input.capturedAt.getTime() });
  }

  if (!input.hasGps) {
    flags.push({ code: "no_gps", message: "No GPS data in EXIF; site was not inferred." });
  } else if (!input.siteMatched) {
    flags.push({
      code: "no_site_match",
      message: "GPS position is outside the radius of every site in this project.",
      value: input.distanceToSiteM ?? undefined,
    });
  } else if (
    input.distanceToSiteM !== null &&
    input.siteRadiusM !== null &&
    input.distanceToSiteM > input.siteRadiusM
  ) {
    flags.push({
      code: "far_from_site",
      message: `Photo is ${Math.round(input.distanceToSiteM)} m from the assigned site (radius ${input.siteRadiusM} m).`,
      value: input.distanceToSiteM,
    });
  }

  if (isValidPhash(input.phash)) {
    for (const peer of input.peers) {
      if (!isValidPhash(peer.phash)) continue;
      const d = hammingDistance(input.phash, peer.phash);
      if (d <= DUPLICATE_THRESHOLD) {
        flags.push({
          code: "duplicate",
          message: `Near-duplicate of another asset (hamming distance ${d}).`,
          relatedAssetId: peer.id,
          value: d,
        });
      }
    }
  }

  // Phase order: an "after" photo dated earlier than a "before" photo at the same site is suspicious.
  if (input.capturedAt && input.siteId && input.phase !== "unknown") {
    const myOrder = PHASE_ORDER[input.phase];
    for (const peer of input.peers) {
      if (peer.siteId !== input.siteId || !peer.capturedAt || peer.phase === "unknown") continue;
      const peerOrder = PHASE_ORDER[peer.phase];
      const earlierPhaseButLaterDate = myOrder < peerOrder && input.capturedAt > peer.capturedAt;
      const laterPhaseButEarlierDate = myOrder > peerOrder && input.capturedAt < peer.capturedAt;
      if (earlierPhaseButLaterDate || laterPhaseButEarlierDate) {
        flags.push({
          code: "phase_order",
          message: `Capture date conflicts with the phase order relative to asset ${peer.id}.`,
          relatedAssetId: peer.id,
        });
        break;
      }
    }
  }

  return flags;
}

/** Flags that should keep an asset out of reports until a human reviews it. */
const BLOCKING: ReadonlySet<AssetFlag["code"]> = new Set(["duplicate", "future_date", "phase_order", "no_site_match"]);

export function isVerified(flags: AssetFlag[]): boolean {
  return !flags.some((f) => BLOCKING.has(f.code));
}
