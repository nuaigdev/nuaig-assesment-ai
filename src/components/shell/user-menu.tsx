"use client";

import { ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import type { UserRole } from "@/lib/supabase/types";

const itemClasses =
  "flex h-9 w-full items-center gap-2.5 rounded-sm px-3 text-left text-sm text-fg hover:bg-surface-sunken";

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string;
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-sm py-1 pr-2 pl-1 text-fg hover:bg-surface-sunken"
      >
        <Avatar name={name} email={email} size="sm" />
        <span className="max-w-48 truncate text-[13px] font-medium">{name ?? email}</span>
        <ChevronDown aria-hidden className="size-4 text-fg-muted" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-30 mt-2 w-64 rounded-md border border-border bg-surface p-1 shadow-panel"
        >
          <div className="px-3 py-2">
            <p className="truncate font-medium text-fg">{name ?? email}</p>
            <p className="truncate text-[13px] text-fg-muted">{email}</p>
            <p className="mt-1 text-xs font-medium text-fg-muted">
              {role === "admin" ? "Admin" : "Team member"}
            </p>
          </div>
          <div className="my-1 border-t border-border" />
          <Link href="/settings" onClick={() => setOpen(false)} className={itemClasses}>
            <Settings aria-hidden className="size-4 text-fg-muted" />
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className={itemClasses}>
              <LogOut aria-hidden className="size-4 text-fg-muted" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
