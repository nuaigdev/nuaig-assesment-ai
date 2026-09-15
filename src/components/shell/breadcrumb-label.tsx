"use client";

import { useEffect, useSyncExternalStore } from "react";

// Record pages know their names (a client, an interview); the breadcrumb bar only knows ids.
// Pages render <BreadcrumbLabel> and the bar reads this tiny store.

const labels = new Map<string, string>();
let snapshot: ReadonlyMap<string, string> = new Map();
const listeners = new Set<() => void>();
const EMPTY: ReadonlyMap<string, string> = new Map();

function publish() {
  snapshot = new Map(labels);
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Names the breadcrumb for a URL segment (usually a record id). Renders nothing. */
export function BreadcrumbLabel({ segment, label }: { segment: string; label: string }) {
  useEffect(() => {
    labels.set(segment, label);
    publish();
    return () => {
      labels.delete(segment);
      publish();
    };
  }, [segment, label]);
  return null;
}

export function useBreadcrumbLabels(): ReadonlyMap<string, string> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
