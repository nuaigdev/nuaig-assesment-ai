import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { JoinFlow } from "@/components/join/join-flow";
import { wakeAgentWorker } from "@/lib/agent/wake";
import { resolveJoinToken } from "@/lib/join/resolve";
import { isTooEarly } from "@/lib/join/timing";
import { clientIp } from "@/lib/request";

/** Magic-link entry (spec §11.10): welcome → consent → device check → call. */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const result = await resolveJoinToken(token, clientIp(await headers()));

  if (result.state === "ended") redirect("/join/ended");
  if (result.state === "rate_limited") redirect("/join/invalid?reason=rate_limited");
  if (result.state === "invalid") redirect("/join/invalid");

  // The interviewee will reach the call after consent and the microphone check; wake the worker now.
  wakeAgentWorker();

  return <JoinFlow token={token} session={result.session} waiting={isTooEarly(result.session.scheduledAt)} />;
}
