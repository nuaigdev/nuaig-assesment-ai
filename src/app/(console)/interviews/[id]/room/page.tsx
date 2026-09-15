import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Live call" };

export default async function Page() {
  await requireUser();
  return <PhaseStub title="Live call" message="The live call arrives in Phase 2." />;
}
