import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Templates" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Templates" message="Templates arrive in Phase 4." />;
}
