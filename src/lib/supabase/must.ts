type QueryResult<T> = { data: T | null; error: { message: string } | null };
type CountResult = { count: number | null; error: { message: string } | null };

/** Unwraps a query result, throwing to the nearest error boundary on failure. */
export function must<T>(result: QueryResult<T>, context: string): T {
  if (result.error || result.data === null) {
    throw new Error(`${context}: ${result.error?.message ?? "no data returned"}`);
  }
  return result.data;
}

export function mustCount(result: CountResult, context: string): number {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.count ?? 0;
}
