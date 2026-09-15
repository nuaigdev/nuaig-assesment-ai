"use client";

import { createContext, useContext } from "react";

import type { ActionState } from "@/lib/actions";

/** The latest result of the surrounding form's server action, for fields to read errors from. */
export const FormStateContext = createContext<ActionState<unknown>>({ status: "idle" });

export function useFieldError(name: string): string | undefined {
  const state = useContext(FormStateContext);
  return state.status === "error" ? state.fieldErrors?.[name] : undefined;
}

/** Form-level error summary. Field-specific messages render next to their fields. */
export function FormMessage() {
  const state = useContext(FormStateContext);
  if (state.status !== "error" || !state.message) return null;
  return (
    <p role="alert" className="rounded-sm bg-live-050 px-3 py-2 text-[13px] text-live-600">
      {state.message}
    </p>
  );
}
