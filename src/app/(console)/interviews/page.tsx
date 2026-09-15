import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Interviews" };

export default async function Page() {
  await requireUser();
  return <PhaseStub title="Interviews" message="The interview list arrives in Phase 1." />;
}
