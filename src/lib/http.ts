/** JSON response that is never cached (tokens, presence, call state). */
export function jsonNoStore(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Error response with a message safe to show the user: `{ error }`. */
export function problem(status: number, message: string): Response {
  return jsonNoStore({ error: message }, status);
}
