"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type ToastTone = "neutral" | "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastFn = (message: string, options?: { tone?: ToastTone }) => void;

const AUTO_DISMISS_MS = 4000;

const ToastContext = createContext<ToastFn | null>(null);

/**
 * Toast host. Console: bottom-right; call stage: bottom-center (spec §9.5).
 * Non-error toasts dismiss after 4s; errors persist until dismissed.
 */
export function ToastProvider({
  children,
  placement = "bottom-right",
}: {
  children: ReactNode;
  placement?: "bottom-right" | "bottom-center";
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastFn>(
    (message, options) => {
      const id = ++nextId.current;
      const tone = options?.tone ?? "neutral";
      setToasts((current) => [...current, { id, message, tone }]);
      if (tone !== "error") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const renderToast = (item: ToastItem) => (
    <div
      key={item.id}
      className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm text-fg shadow-float"
    >
      {item.tone === "success" && (
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-ok-700" />
      )}
      {item.tone === "error" && (
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-live-600" />
      )}
      <p className="flex-1">{item.message}</p>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss notification"
        className="-mr-1 rounded-sm p-0.5 text-fg-muted hover:text-fg"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed bottom-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2",
          placement === "bottom-right" ? "right-4" : "left-1/2 -translate-x-1/2",
        )}
      >
        <div role="alert" className="flex flex-col gap-2">
          {toasts.filter((item) => item.tone === "error").map(renderToast)}
        </div>
        <div aria-live="polite" className="flex flex-col gap-2">
          {toasts.filter((item) => item.tone !== "error").map(renderToast)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return toast;
}
