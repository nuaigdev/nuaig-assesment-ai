/** Interviewees can continue, and get a call token, from this long before the start (spec §11.10). */
export const EARLY_JOIN_MS = 15 * 60 * 1000;

export function isTooEarly(scheduledAt: string | null, now: number = Date.now()): boolean {
  return scheduledAt !== null && new Date(scheduledAt).getTime() - now > EARLY_JOIN_MS;
}
