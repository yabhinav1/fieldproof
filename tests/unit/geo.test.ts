import { describe, expect, it } from "vitest";
import { extractGps, haversineM, nearest, parseCoordinate } from "@/server/lib/geo";

describe("parseCoordinate", () => {
  it("parses decimals and hemisphere refs", () => {
    expect(parseCoordinate(28.6139)).toBeCloseTo(28.6139);
    expect(parseCoordinate("28.6139")).toBeCloseTo(28.6139);
    expect(parseCoordinate("77.2090", "W")).toBeCloseTo(-77.209);
    expect(parseCoordinate("28.6139 S")).toBeCloseTo(-28.6139);
  });

  it("parses ExifTool DMS strings", () => {
    expect(parseCoordinate(`28 deg 36' 50.04" N`)).toBeCloseTo(28.6139, 3);
    expect(parseCoordinate(`77 deg 12' 32.40" E`)).toBeCloseTo(77.209, 3);
    expect(parseCoordinate(`28°36'50.04"S`)).toBeCloseTo(-28.6139, 3);
  });

  it("parses [deg, min, sec] arrays", () => {
    expect(parseCoordinate([28, 36, 50.04], "N")).toBeCloseTo(28.6139, 3);
    expect(parseCoordinate([77, 12, 32.4], "W")).toBeCloseTo(-77.209, 3);
  });

  it("rejects junk", () => {
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("abc")).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate(Number.NaN)).toBeNull();
  });
});

describe("extractGps", () => {
  it("returns null without coordinates or for 0,0", () => {
    expect(extractGps({})).toBeNull();
    expect(extractGps({ GPSLatitude: "0", GPSLongitude: "0" })).toBeNull();
    expect(extractGps({ GPSLatitude: "95", GPSLongitude: "10" })).toBeNull();
  });

  it("combines value + ref fields", () => {
    const gps = extractGps({
      GPSLatitude: `28 deg 36' 50.04"`,
      GPSLatitudeRef: "North",
      GPSLongitude: `77 deg 12' 32.40"`,
      GPSLongitudeRef: "East",
    });
    expect(gps?.lat).toBeCloseTo(28.6139, 3);
    expect(gps?.lng).toBeCloseTo(77.209, 3);
  });
});

describe("haversine / nearest", () => {
  const indiaGate = { lat: 28.6129, lng: 77.2295 };
  const redFort = { lat: 28.6562, lng: 77.241 };

  it("measures known distances", () => {
    const d = haversineM(indiaGate, redFort);
    expect(d).toBeGreaterThan(4500);
    expect(d).toBeLessThan(5200);
    expect(haversineM(indiaGate, indiaGate)).toBe(0);
  });

  it("finds the nearest candidate", () => {
    const sites = [
      { id: "a", lat: 28.66, lng: 77.24 },
      { id: "b", lat: 28.61, lng: 77.23 },
    ];
    expect(nearest(indiaGate, sites)?.item.id).toBe("b");
    expect(nearest(indiaGate, [])).toBeNull();
  });
});
