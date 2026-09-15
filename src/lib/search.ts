/** Escapes LIKE wildcards so user input matches literally inside an ilike pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Pulls a single string out of Next.js search params. */
export function searchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}
