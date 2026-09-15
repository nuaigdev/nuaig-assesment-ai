import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Template" };

export default async function Page() {
  await requireAdmin();
  return <PhaseStub title="Template" message="The template editor arrives in Phase 4." />;
}
