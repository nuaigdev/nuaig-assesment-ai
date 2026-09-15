import { Avatar } from "./avatar";

type Person = { full_name: string | null; email: string };

/** Overlapping avatars with a +N overflow; names are exposed to assistive tech. */
export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  if (people.length === 0) {
    return <span className="text-fg-muted">—</span>;
  }
  const shown = people.slice(0, max);
  const names = people.map((person) => person.full_name ?? person.email).join(", ");
  return (
    <span className="inline-flex items-center" title={names}>
      <span className="sr-only">{names}</span>
      {shown.map((person, index) => (
        <span
          key={`${person.email}-${index}`}
          className="-ml-1.5 rounded-full ring-2 ring-surface first:ml-0"
        >
          <Avatar name={person.full_name} email={person.email} size="sm" />
        </span>
      ))}
      {people.length > max && (
        <span
          aria-hidden
          className="-ml-1.5 inline-flex size-7 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-fg-muted ring-2 ring-surface"
        >
          +{people.length - max}
        </span>
      )}
    </span>
  );
}
