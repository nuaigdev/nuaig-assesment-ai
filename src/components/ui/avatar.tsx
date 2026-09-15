import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const SIZES = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
};

export function Avatar({
  name,
  email,
  size = "md",
}: {
  name: string | null;
  email: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-050 font-semibold text-brand-700",
        SIZES[size],
      )}
    >
      {initials(name, email)}
    </span>
  );
}
