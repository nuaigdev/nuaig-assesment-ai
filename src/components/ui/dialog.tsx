"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Modal built on native <dialog>: focus trapping, Escape and top-layer stacking come from
 * the browser. Controlled — `onClose` fires for Escape, backdrop click and programmatic close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface p-0 text-fg shadow-float backdrop:bg-black/40"
    >
      <div className="px-5 pt-5 pb-4">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1 text-[13px] text-fg-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      )}
    </dialog>
  );
}
