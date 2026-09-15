import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Schedule interview" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Schedule interview" message="Scheduling arrives in Phase 1." />;
}
