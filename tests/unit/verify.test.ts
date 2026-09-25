import { describe, expect, it } from "vitest";
import { hammingDistance, isValidPhash } from "@/server/lib/phash";
import { isVerified, verifyAsset } from "@/server/lib/verify";

describe("phash", () => {
  it("validates 16-hex strings", () => {
    expect(isValidPhash("a1b2c3d4e5f60718")).toBe(true);
    expect(isValidPhash("zzz")).toBe(false);
    expect(isValidPhash(null)).toBe(false);
  });
  it("computes hamming distance", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
  });
});

const base = {
  capturedAt: new Date("2026-03-10T10:00:00Z"),
  hasGps: true,
  siteMatched: true,
  distanceToSiteM: 120,
  siteRadiusM: 2000,
  phase: "during" as const,
  phash: "a1b2c3d4e5f60718",
  peers: [],
  siteId: "site-1",
  now: new Date("2026-09-25T00:00:00Z"),
};

describe("verifyAsset", () => {
  it("passes a clean asset", () => {
    const flags = verifyAsset(base);
    expect(flags).toEqual([]);
    expect(isVerified(flags)).toBe(true);
  });

  it("flags missing GPS and date (non-blocking)", () => {
    const flags = verifyAsset({ ...base, hasGps: false, capturedAt: null, siteMatched: false });
    expect(flags.map((f) => f.code).sort()).toEqual(["no_capture_date", "no_gps"]);
    expect(isVerified(flags)).toBe(true);
  });

  it("flags future dates and no site match (blocking)", () => {
    const flags = verifyAsset({ ...base, capturedAt: new Date("2027-01-01"), siteMatched: false, distanceToSiteM: 9000 });
    expect(flags.map((f) => f.code).sort()).toEqual(["future_date", "no_site_match"]);
    expect(isVerified(flags)).toBe(false);
  });

  it("flags near-duplicates by phash", () => {
    const flags = verifyAsset({
      ...base,
      peers: [
        { id: "dup", phash: "a1b2c3d4e5f60719", phase: "during", capturedAt: null, siteId: "site-1" },
        { id: "far", phash: "ffffffffffffffff", phase: "during", capturedAt: null, siteId: "site-1" },
      ],
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ code: "duplicate", relatedAssetId: "dup", value: 1 });
    expect(isVerified(flags)).toBe(false);
  });

  it("flags phase order conflicts at the same site only", () => {
    const beforeButLater = verifyAsset({
      ...base,
      phase: "before",
      capturedAt: new Date("2026-08-01"),
      peers: [{ id: "x", phash: null, phase: "after", capturedAt: new Date("2026-06-01"), siteId: "site-1" }],
    });
    expect(beforeButLater.map((f) => f.code)).toEqual(["phase_order"]);

    const otherSite = verifyAsset({
      ...base,
      phase: "before",
      capturedAt: new Date("2026-08-01"),
      peers: [{ id: "x", phash: null, phase: "after", capturedAt: new Date("2026-06-01"), siteId: "site-2" }],
    });
    expect(otherSite).toEqual([]);
  });
});
