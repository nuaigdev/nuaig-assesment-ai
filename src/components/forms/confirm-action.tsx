"use client";

import { useState, useTransition, type ReactNode } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions";

/** A button that asks for confirmation, then runs a (bound) server action. */
export function ConfirmAction({
  triggerLabel,
  triggerVariant = "secondary",
  triggerSize = "sm",
  title,
  description,
  confirmLabel,
  destructive = false,
  action,
  successMessage = "Done",
  onSuccess,
}: {
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => Promise<ActionState<unknown>>;
  successMessage?: string;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") {
        setOpen(false);
        onSuccess?.();
        toast(result.message ?? successMessage, { tone: "success" });
      } else if (result.status === "error") {
        setError(result.message ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant={destructive ? "destructive" : "primary"} onClick={confirm} disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="rounded-sm bg-live-050 px-3 py-2 text-[13px] text-live-600">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
