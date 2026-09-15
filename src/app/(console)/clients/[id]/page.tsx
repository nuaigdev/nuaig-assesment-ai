import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Client" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Client" message="Client details arrive in Phase 1." />;
}
