import { revalidatePath } from "next/cache";

import { getActiveUser } from "@/lib/auth/session";
import { jsonNoStore, problem } from "@/lib/http";
import { isUuid } from "@/lib/ids";
import { isJoinable, loadStaffCall, teardownInterview } from "@/lib/interviews/call";

/** End interview from the call (stopping criterion 4, spec §13): stewards and admins. */
export async function POST(_request: Request, { params }: RouteContext<"/api/interviews/[id]/end">) {
  const user = await getActiveUser();
  if (!user) return problem(401, "Sign in to end the interview.");

  const { id } = await params;
  if (!isUuid(id)) return problem(404, "Interview not found.");
  const call = await loadStaffCall(user, id);
  if (!call) return problem(404, "Interview not found.");
  if (!call.canEnd) return problem(403, "Only the steward or an admin can end the interview.");
  if (!isJoinable(call.interview.status)) return problem(409, "This interview has already ended.");

  const status = await teardownInterview(id, "steward_stopped", { actorId: user.id });

  revalidatePath("/");
  revalidatePath("/interviews");
  revalidatePath(`/interviews/${id}`);
  return jsonNoStore({ status });
}
