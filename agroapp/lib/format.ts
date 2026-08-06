/**
 * Rendering helpers for values that are legitimately absent.
 *
 * A sensor omits a field when the hardware behind it is not reporting — an
 * unplugged 4-in-1 board sends no `phWater` key at all. The UI has to show that
 * as "no data" rather than as a number, because every plausible substitute
 * (`0`, `—` styled as a reading, a dash inside a unit) reads like a measurement.
 * One helper, used everywhere, keeps that consistent.
 */

/** What an absent value looks like. An em dash, never a zero. */
export const ABSENT = "—";

/** A number to fixed precision, or `—` when there is nothing to show. */
export function fmt(value: number | null | undefined, dp = 1): string {
  if (value === null || value === undefined) return ABSENT;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? ABSENT : parsed.toFixed(dp);
}

/** A number with a trailing unit, or a bare `—`. The unit is dropped with the
 *  value, so an absent reading never renders as "— %". */
export function fmtUnit(
  value: number | null | undefined,
  unit: string,
  dp = 1,
): string {
  const text = fmt(value, dp);
  return text === ABSENT ? ABSENT : `${text}${unit}`;
}

/** Local date and time, or `—`. */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return ABSENT;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? ABSENT : date.toLocaleString();
}

/** Coarse "how long ago", for liveness columns. */
export function fmtRelative(value: string | null | undefined): string {
  if (!value) return "Never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return ABSENT;

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}
