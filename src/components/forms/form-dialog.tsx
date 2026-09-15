"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { IDLE, type ActionState } from "@/lib/actions";

import { FormMessage, FormStateContext } from "./form-state";

type FormAction = (state: ActionState<unknown>, formData: FormData) => Promise<ActionState<unknown>>;

/**
 * A button that opens a dialog containing a server-action form. Fields inside read their
 * errors from context (TextField & co). On success the dialog closes and a toast confirms;
 * actions that redirect navigate away instead.
 */
export function FormDialog({
  triggerLabel,
  triggerVariant = "primary",
  triggerSize = "md",
  title,
  description,
  action,
  submitLabel = "Save",
  successMessage = "Saved",
  children,
}: {
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  title: string;
  description?: string;
  action: FormAction;
  submitLabel?: string;
  successMessage?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        {/* Mounted only while open, so every opening starts with fresh values and no stale errors. */}
        {open && (
          <DialogForm
            action={action}
            submitLabel={submitLabel}
            successMessage={successMessage}
            onClose={() => setOpen(false)}
          >
            {children}
          </DialogForm>
        )}
      </Dialog>
    </>
  );
}

function DialogForm({
  action,
  submitLabel,
  successMessage,
  onClose,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  successMessage: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<ActionState<unknown>, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "success") {
        onClose();
        toast(result.message ?? successMessage, { tone: "success" });
      }
      return result;
    },
    IDLE,
  );

  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className="space-y-4">
        <FormMessage />
        {children}
        <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </FormStateContext.Provider>
  );
}
