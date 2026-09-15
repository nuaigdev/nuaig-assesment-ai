import type { Metadata } from "next";

import { PhaseStub } from "@/components/shell/phase-stub";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Assessment" };

export default async function Page() {
  await requireUser();
  return <PhaseStub title="Assessment" message="Assessment details arrive in Phase 1." />;
}
