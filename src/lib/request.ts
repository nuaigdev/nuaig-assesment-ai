type HeaderReader = { get(name: string): string | null };

/** Best-effort client IP behind Vercel's proxy. Only for rate limiting, never for auth. */
export function clientIp(headers: HeaderReader): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return headers.get("x-real-ip");
}
