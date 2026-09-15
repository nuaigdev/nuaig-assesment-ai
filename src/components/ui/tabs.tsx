"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: ReactNode; content: ReactNode };

/** WAI-ARIA tabs with roving focus (arrow keys, Home, End). */
export function Tabs({
  items,
  label,
  defaultTabId,
  className,
}: {
  items: TabItem[];
  label: string;
  defaultTabId?: string;
  className?: string;
}) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  function activate(index: number) {
    const item = items[(index + items.length) % items.length];
    setActiveId(item.id);
    tabRefs.current.get(item.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    activate(moves[event.key]);
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border">
        {items.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "-mb-px h-10 border-b-2 px-3 text-sm font-medium transition-colors duration-150 ease-out",
                selected
                  ? "border-brand text-fg"
                  : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== activeId}
          tabIndex={0}
          className="pt-5"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
