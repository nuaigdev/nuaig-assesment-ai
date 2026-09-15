"use client";

import { useSyncExternalStore } from "react";

const FORMATS: Record<"datetime" | "date" | "time", Intl.DateTimeFormatOptions> = {
  datetime: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
};

const noopSubscribe = () => () => {};

/** Formats in the viewer's locale and timezone. Renders a blank on the server to avoid mismatches. */
export function LocalTime({
  iso,
  format = "datetime",
}: {
  iso: string;
  format?: keyof typeof FORMATS;
}) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={iso}>
      {isClient ? new Intl.DateTimeFormat(undefined, FORMATS[format]).format(new Date(iso)) : " "}
    </time>
  );
}
