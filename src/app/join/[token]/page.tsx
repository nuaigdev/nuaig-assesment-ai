import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { JoinFlow } from "@/components/join/join-flow";
import { resolveJoinToken } from "@/lib/join/resolve";
import { clientIp } from "@/lib/request";

/** Before this, the page shows a waiting state instead of letting the interviewee continue (spec §11.10). */
const EARLY_JOIN_MS = 15 * 60 * 1000;

function isTooEarly(scheduledAt: string | null) {
  return scheduledAt !== null && new Date(scheduledAt).getTime() - Date.now() > EARLY_JOIN_MS;
}

/** Magic-link entry: welcome → consent → (Phase 2) device check and call. */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const result = await resolveJoinToken(token, clientIp(await headers()));

  if (result.state === "ended") redirect("/join/ended");
  if (result.state === "rate_limited") redirect("/join/invalid?reason=rate_limited");
  if (result.state === "invalid") redirect("/join/invalid");

  return <JoinFlow session={result.session} waiting={isTooEarly(result.session.scheduledAt)} />;
}
