export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[13px] text-fg-muted tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}
