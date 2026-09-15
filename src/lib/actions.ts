import type { ZodError } from "zod";

/** Result of a server action used with useActionState or a transition. */
export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: T }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

export const IDLE = { status: "idle" } as const;

export function success<T = undefined>(message?: string, data?: T): ActionState<T> {
  return { status: "success", message, data };
}

export function failure(message: string): ActionState<never> {
  return { status: "error", message };
}

/** Maps zod issues onto field names (the `name` attribute of each form control). First issue wins. */
export function fieldErrorsFrom(error: ZodError, fallbackKey = "form"): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || fallbackKey;
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export function invalid(error: ZodError): ActionState<never> {
  const fieldErrors = fieldErrorsFrom(error);
  return {
    status: "error",
    message: fieldErrors.form ?? "Check the highlighted fields.",
    fieldErrors,
  };
}

type DatabaseError = { code?: string; message: string };

/**
 * Turns Postgres / PostgREST errors into messages that are safe to show staff.
 * Our own SQL functions raise 22023 / P0002 with user-facing text, so those pass through.
 */
export function databaseErrorMessage(
  error: DatabaseError,
  fallback = "Something went wrong. Please try again.",
): string {
  switch (error.code) {
    case "22023":
    case "P0002":
      return error.message;
    case "23505":
      return "That already exists.";
    case "23503":
      return "It’s still in use, so it can’t be removed.";
    case "42501":
      return error.message.includes("last active admin")
        ? "You can’t remove the last active admin."
        : "You don’t have permission to do that.";
    default:
      return fallback;
  }
}

/** Reads string fields from FormData; missing fields become "" so zod can report them. */
export function readForm<const K extends string>(formData: FormData, keys: readonly K[]) {
  return Object.fromEntries(
    keys.map((key) => {
      const value = formData.get(key);
      return [key, typeof value === "string" ? value : ""];
    }),
  ) as Record<K, string>;
}
