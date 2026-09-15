import type { AppUser } from "@/lib/supabase/types";

import { Breadcrumbs } from "./breadcrumbs";
import { UserMenu } from "./user-menu";

export function TopBar({ user }: { user: AppUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-8">
      <Breadcrumbs />
      <UserMenu name={user.full_name} email={user.email} role={user.role} />
    </header>
  );
}
