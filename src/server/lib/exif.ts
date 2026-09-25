/**
 * Parses capture timestamps from EXIF as Cloudinary's `image_metadata` reports them.
 * Typical values: "2026:03:14 10:22:31", "2026:03:14 10:22:31+05:30", "2026-03-14T10:22:31Z".
 */
export function parseExifDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.startsWith("0000")) return null;

  // EXIF "YYYY:MM:DD HH:MM:SS[.fff][±HH:MM|Z]"
  const m = s.match(
    /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (m) {
    const [, y, mo, d, h, mi, sec, , tz] = m;
    // EXIF times without an offset are camera-local with an unknown zone. We treat them as UTC so
    // phase assignment is deterministic regardless of where the server runs.
    const zone = tz ? tz.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2") : "Z";
    const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}${zone}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? null : date;
}

const CAPTURE_KEYS = ["DateTimeOriginal", "CreateDate", "DateTimeDigitized", "DateTime", "ModifyDate"];

/** Picks the best available capture time from EXIF, preferring the original shutter time. */
export function extractCapturedAt(meta: Record<string, unknown> | null | undefined): Date | null {
  if (!meta) return null;
  const offset = typeof meta.OffsetTimeOriginal === "string" ? meta.OffsetTimeOriginal : undefined;
  for (const key of CAPTURE_KEYS) {
    const raw = meta[key];
    if (typeof raw !== "string") continue;
    // If EXIF has a separate offset field and the value has no zone, glue them together.
    const withOffset = offset && !/(Z|[+-]\d{2}:?\d{2})$/.test(raw.trim()) ? `${raw.trim()}${offset}` : raw;
    const d = parseExifDate(withOffset);
    if (d) return d;
  }
  return null;
}
