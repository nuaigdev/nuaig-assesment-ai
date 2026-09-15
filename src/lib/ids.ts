const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params and bound action args are user-controlled; check shape before querying. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
