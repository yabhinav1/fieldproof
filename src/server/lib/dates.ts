import { z } from "zod";

/**
 * Upper bound for a date-range filter. A bare date ("2026-09-01") means through the end of that
 * day; parsed as-is it would be midnight and drop every photo taken on the day itself.
 */
export const InclusiveEndDate = z.string().transform((value, ctx) => {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? `${value.trim()}T23:59:59.999Z` : value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid date" });
    return z.NEVER;
  }
  return date;
});
