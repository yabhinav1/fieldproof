/**
 * Perceptual-hash helpers. Cloudinary returns `phash` as a 16-character hex string (64 bits).
 */

export function isValidPhash(h: unknown): h is string {
  return typeof h === "string" && /^[0-9a-f]{16}$/i.test(h);
}

/** Number of differing bits between two 64-bit hex hashes. */
export function hammingDistance(a: string, b: string): number {
  if (!isValidPhash(a) || !isValidPhash(b)) throw new Error("hammingDistance expects 16-char hex phashes");
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x) {
    x &= x - 1n;
    count++;
  }
  return count;
}

/** Hamming distance at or below this is treated as a near-duplicate. */
export const DUPLICATE_THRESHOLD = 8;
