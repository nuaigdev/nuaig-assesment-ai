/** Joins class names. No conflict resolution — don't pass classes that fight each other. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
