"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";

import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/hooks/use-now";
import type { InterviewStatus } from "@/lib/supabase/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActiveInvitation = { created_at: string; expires_at: string; first_used_at: string | null };

/**
 * Magic-link management (spec §11.5). The raw link is shown once, right after it is generated,
 * and lives only in this component's memory; afterwards only its status is shown.
 */
export function JoinLinkPanel({
  status,
  invitation,
  intervieweeName,
  highlight,
  issueAction,
  revokeAction,
}: {
  status: InterviewStatus;
  invitation: ActiveInvitation | null;
  intervieweeName: string | null;
  highlight: boolean;
  issueAction: () => Promise<ActionState<{ url: string }>>;
  revokeAction: () => Promise<ActionState>;
}) {
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReissue, setConfirmReissue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const now = useNow();

  const canManage = status === "scheduled" || status === "ready" || status === "live";
  const ended = status === "completed" || status === "cancelled" || status === "failed";
  const recipient = intervieweeName ?? "the interviewee";
  const expiresAt = invitation ? new Date(invitation.expires_at).getTime() : null;
  const expired = expiresAt !== null && now !== null && expiresAt <= now;
  const daysLeft = expiresAt !== null && now !== null ? Math.max(1, Math.ceil((expiresAt - now) / DAY_MS)) : null;

  function issue() {
    setError(null);
    startTransition(async () => {
      const result = await issueAction();
      if (result.status === "success" && result.data) {
        setRevealedUrl(result.data.url);
        setCopied(false);
        setConfirmReissue(false);
      } else if (result.status === "error") {
        setConfirmReissue(false);
        setError(result.message ?? "Couldn’t generate a join link. Please try again.");
      }
    });
  }

  async function copy() {
    if (!revealedUrl) return;
    try {
      await navigator.clipboard.writeText(revealedUrl);
      setCopied(true);
      toast("Join link copied", { tone: "success" });
    } catch {
      toast("Couldn’t copy automatically. Select the link and copy it.", { tone: "error" });
    }
  }

  return (
    <Card id="join-link" className={cn(highlight && !invitation && "ring-2 ring-brand")}>
      <CardHeader
        title="Join link"
        description={
          ended
            ? "Join links are revoked automatically when an interview ends."
            : "The interviewee opens this link to join. No account or download needed."
        }
      />
      <CardBody className="space-y-4">
        {ended ? (
          <p className="text-sm text-fg-muted">
            {status === "completed"
              ? "This interview is complete, so its join link no longer works."
              : "This interview has ended, so its join link no longer works."}
          </p>
        ) : revealedUrl ? (
          <div className="space-y-2">
            <label htmlFor="join-url" className="block text-xs font-medium text-fg">
              Send this link to {recipient}
            </label>
            <div className="flex gap-2">
              <Input
                id="join-url"
                readOnly
                value={revealedUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-[13px]"
              />
              <Button onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[13px] text-warn-700">
              Copy it now. For security the link can’t be shown again. If it’s lost, reissue it.
            </p>
          </div>
        ) : invitation ? (
          <p className="text-sm text-fg">
            {expired ? "Link expired " : "Link issued "}
            <LocalTime iso={expired ? invitation.expires_at : invitation.created_at} format="date" />
            {!expired && daysLeft !== null && ` · expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}
            <span className="text-fg-muted">
              {" · "}
              {invitation.first_used_at ? "opened by the interviewee" : "not opened yet"}
            </span>
          </p>
        ) : (
          <p className="text-sm text-fg-muted">
            {highlight && canManage
              ? `Interview scheduled. Generate a join link to send to ${recipient}.`
              : "No join link yet."}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-sm bg-live-050 px-3 py-2 text-[13px] text-live-600">
            {error}
          </p>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {invitation ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmReissue(true)} disabled={pending}>
                Reissue link
              </Button>
            ) : (
              <Button onClick={issue} disabled={pending}>
                {pending ? "Generating…" : "Generate join link"}
              </Button>
            )}
            {invitation && (
              <ConfirmAction
                triggerLabel="Revoke"
                triggerVariant="ghost"
                title="Revoke join link?"
                description="The link stops working immediately. You can generate a new one afterwards."
                confirmLabel="Revoke link"
                destructive
                action={revokeAction}
                successMessage="Join link revoked"
                onSuccess={() => setRevealedUrl(null)}
              />
            )}
          </div>
        )}
      </CardBody>

      <Dialog
        open={confirmReissue}
        onClose={() => setConfirmReissue(false)}
        title="Reissue join link?"
        description="The current link stops working immediately and a new one is created. Send the new link to the interviewee."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReissue(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={issue} disabled={pending}>
              {pending ? "Generating…" : "Reissue link"}
            </Button>
          </>
        }
      />
    </Card>
  );
}
