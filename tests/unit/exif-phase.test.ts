import { describe, expect, it } from "vitest";
import { extractCapturedAt, parseExifDate } from "@/server/lib/exif";
import { assignPhase } from "@/server/lib/phase";

describe("parseExifDate", () => {
  it("parses EXIF colon dates", () => {
    expect(parseExifDate("2026:03:14 10:22:31")?.toISOString().slice(0, 19)).toBe("2026-03-14T10:22:31");
  });
  it("respects timezone suffixes", () => {
    expect(parseExifDate("2026:03:14 10:22:31+05:30")?.toISOString()).toBe("2026-03-14T04:52:31.000Z");
    expect(parseExifDate("2026:03:14 10:22:31Z")?.toISOString()).toBe("2026-03-14T10:22:31.000Z");
  });
  it("rejects zero / junk dates", () => {
    expect(parseExifDate("0000:00:00 00:00:00")).toBeNull();
    expect(parseExifDate("")).toBeNull();
    expect(parseExifDate(42)).toBeNull();
  });
});

describe("extractCapturedAt", () => {
  it("prefers DateTimeOriginal and applies OffsetTimeOriginal", () => {
    const d = extractCapturedAt({
      ModifyDate: "2026:05:01 00:00:00",
      DateTimeOriginal: "2026:03:14 10:22:31",
      OffsetTimeOriginal: "+05:30",
    });
    expect(d?.toISOString()).toBe("2026-03-14T04:52:31.000Z");
  });
  it("falls back down the key list", () => {
    expect(extractCapturedAt({ CreateDate: "2026:01:02 03:04:05" })?.getUTCFullYear()).toBe(2026);
    expect(extractCapturedAt({})).toBeNull();
    expect(extractCapturedAt(null)).toBeNull();
  });
});

describe("assignPhase", () => {
  const b = { duringStart: new Date("2026-03-01"), afterStart: new Date("2026-06-01") };
  it("splits before / during / after", () => {
    expect(assignPhase(new Date("2026-01-15"), b)).toBe("before");
    expect(assignPhase(new Date("2026-04-15"), b)).toBe("during");
    expect(assignPhase(new Date("2026-06-01"), b)).toBe("after");
    expect(assignPhase(new Date("2026-09-01"), b)).toBe("after");
  });
  it("handles missing boundaries and dates", () => {
    expect(assignPhase(null, b)).toBe("unknown");
    expect(assignPhase(new Date(), { duringStart: null, afterStart: null })).toBe("unknown");
    expect(assignPhase(new Date("2026-01-01"), { duringStart: null, afterStart: new Date("2026-06-01") })).toBe("before");
    expect(assignPhase(new Date("2026-07-01"), { duringStart: new Date("2026-03-01"), afterStart: null })).toBe("during");
  });
});
