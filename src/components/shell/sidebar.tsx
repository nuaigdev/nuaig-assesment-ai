"use client";

import {
  BookOpen,
  Building2,
  CalendarClock,
  FileText,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

// Route map: spec §10. Admin-only entries are hidden from members; pages also guard themselves.
const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/clients", label: "Clients", icon: Building2, adminOnly: true },
  { href: "/templates", label: "Templates", icon: FileText, adminOnly: true },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen, adminOnly: true },
  { href: "/team", label: "Team", icon: Users, adminOnly: true },
  { href: "/audit", label: "Audit log", icon: ScrollText, adminOnly: true },
];

const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", icon: Settings };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-150 ease-out",
        active
          ? "bg-brand-050 font-medium text-brand-700"
          : "text-fg-muted hover:bg-surface-sunken hover:text-fg",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = MAIN_NAV.filter((item) => !item.adminOnly || role === "admin");

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center px-5">
        <Link href="/" aria-label="NuAIg dashboard" className="rounded-sm">
          <Logo height={30} />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border px-3 py-2">
        <NavLink item={SETTINGS_NAV} pathname={pathname} />
      </div>
    </aside>
  );
}
