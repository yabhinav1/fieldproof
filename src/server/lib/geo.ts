const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearest<T extends LatLng>(point: LatLng, candidates: T[]): { item: T; distanceM: number } | null {
  let best: { item: T; distanceM: number } | null = null;
  for (const c of candidates) {
    const d = haversineM(point, c);
    if (!best || d < best.distanceM) best = { item: c, distanceM: d };
  }
  return best;
}

/**
 * Parses a GPS coordinate as Cloudinary / ExifTool report it.
 * Accepts decimals ("28.6139", -77.2), DMS strings ("28 deg 36' 50.04\" N", "77°12'34.5\"E"),
 * and [deg, min, sec] arrays. `ref` may be "N" | "S" | "E" | "W" when given separately.
 */
export function parseCoordinate(value: unknown, ref?: unknown): number | null {
  if (value === null || value === undefined) return null;

  let sign = 1;
  const refStr = typeof ref === "string" ? ref.trim().toUpperCase() : "";
  if (refStr.startsWith("S") || refStr.startsWith("W")) sign = -1;

  if (typeof value === "number") return Number.isFinite(value) ? sign * value : null;

  if (Array.isArray(value)) {
    const [d, m = 0, s = 0] = value.map(Number);
    if (![d, m, s].every(Number.isFinite)) return null;
    return sign * (Math.abs(d) + m / 60 + s / 3600) * (d < 0 ? -1 : 1);
  }

  if (typeof value !== "string") return null;
  const str = value.trim();
  if (!str) return null;

  // Plain decimal, optionally with trailing hemisphere.
  const dec = str.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?$/i);
  if (dec) {
    const n = Number(dec[1]);
    const hemi = dec[2]?.toUpperCase();
    const s2 = hemi === "S" || hemi === "W" ? -1 : 1;
    return Number.isFinite(n) ? sign * s2 * n : null;
  }

  // DMS: 28 deg 36' 50.04" N   |   28°36'50.04"N   |   28 36 50.04 N
  const dms = str.match(
    /^(-?\d+(?:\.\d+)?)\s*(?:deg|°)?\s*(\d+(?:\.\d+)?)?\s*'?\s*(\d+(?:\.\d+)?)?\s*"?\s*([NSEW])?$/i,
  );
  if (dms) {
    const d = Number(dms[1]);
    const m = dms[2] ? Number(dms[2]) : 0;
    const s = dms[3] ? Number(dms[3]) : 0;
    const hemi = dms[4]?.toUpperCase();
    const s2 = hemi === "S" || hemi === "W" ? -1 : 1;
    const abs = Math.abs(d) + m / 60 + s / 3600;
    return sign * s2 * (d < 0 ? -abs : abs);
  }

  return null;
}

/** Extracts a lat/lng pair from an EXIF-like metadata object, if present and valid. */
export function extractGps(meta: Record<string, unknown> | null | undefined): LatLng | null {
  if (!meta) return null;
  const lat = parseCoordinate(meta.GPSLatitude, meta.GPSLatitudeRef);
  const lng = parseCoordinate(meta.GPSLongitude, meta.GPSLongitudeRef);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}
