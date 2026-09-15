import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Audit log" message="The audit log view arrives in Phase 1." />;
}
