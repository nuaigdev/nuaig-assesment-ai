import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Align = "left" | "right";

/** Sticky header, 44px rows, no zebra, sunken hover. Right-align dates and durations (spec §9.5). */
export function Table({ className, children, ...props }: ComponentProps<"table">) {
  return (
    <div className="max-h-[calc(100dvh-12rem)] overflow-auto rounded-md border border-border bg-surface shadow-panel">
      <table
        className={cn("w-full border-separate border-spacing-0 text-left text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 z-10 bg-surface", className)} {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("group transition-colors duration-150 ease-out hover:bg-surface-sunken", className)}
      {...props}
    />
  );
}

export function TH({ align = "left", className, ...props }: ComponentProps<"th"> & { align?: Align }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 border-b border-border px-4 text-xs font-medium whitespace-nowrap text-fg-muted",
        align === "right" && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ align = "left", className, ...props }: ComponentProps<"td"> & { align?: Align }) {
  return (
    <td
      className={cn(
        "h-11 border-b border-border px-4 group-last:border-b-0",
        align === "right" && "text-right whitespace-nowrap tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
