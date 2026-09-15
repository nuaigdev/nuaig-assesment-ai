import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Team" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Team" message="Team management arrives in Phase 1." />;
}
