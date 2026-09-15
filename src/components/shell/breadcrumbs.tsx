"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  interviews: "Interviews",
  new: "New interview",
  room: "Live call",
  clients: "Clients",
  assessments: "Assessments",
  templates: "Templates",
  knowledge: "Knowledge",
  team: "Team",
  settings: "Settings",
  audit: "Audit log",
};

// Index routes that exist as pages (there is no /assessments list).
const INDEX_ROUTES = new Set(["/interviews", "/clients", "/templates", "/knowledge", "/team", "/settings", "/audit"]);
// Sections whose second segment is a record id with its own detail page.
const DETAIL_SECTIONS = new Set(["interviews", "clients", "assessments", "templates"]);

type Crumb = { href: string; label: string; linkable: boolean };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ href: "/", label: "Dashboard", linkable: false }];
  }
  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    // Record names arrive with the detail pages in Phase 1; until then ids read as "Details".
    const label = LABELS[segment] ?? "Details";
    const linkable =
      INDEX_ROUTES.has(href) || (index === 1 && DETAIL_SECTIONS.has(segments[0]) && segment !== "new");
    return { href, label, linkable };
  });
}

export function Breadcrumbs() {
  const crumbs = buildCrumbs(usePathname());

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[13px]">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />}
              {isLast ? (
                <span aria-current="page" className="truncate font-medium text-fg">
                  {crumb.label}
                </span>
              ) : crumb.linkable ? (
                <Link href={crumb.href} className="truncate rounded-sm text-fg-muted hover:text-fg">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-fg-muted">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
