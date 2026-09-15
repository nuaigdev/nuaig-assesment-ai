/** Only same-origin, non-auth paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/login") ||
    value.startsWith("/auth")
  ) {
    return "/";
  }
  return value;
}
