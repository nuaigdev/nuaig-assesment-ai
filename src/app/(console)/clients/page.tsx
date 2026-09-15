import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Clients" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Clients" message="Client management arrives in Phase 1." />;
}
