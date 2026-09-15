import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import { StaffCall } from "@/components/call/staff-call";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { loadStaffCall } from "@/lib/interviews/call";

export const metadata: Metadata = { title: "Live call" };

/** The NuAIg call view (spec §12): listen-only, with the roster, and steering from Phase 6. */
export default async function InterviewRoomPage({ params }: PageProps<"/interviews/[id]/room">) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const call = await loadStaffCall(user, id);
  if (!call) notFound();
  if (!call.role) forbidden();

  return (
    <StaffCall
      interviewId={id}
      title={call.interview.title}
      status={call.interview.status}
      role={call.role}
      canEnd={call.canEnd}
      intervieweeName={call.interview.intervieweeName}
    />
  );
}
