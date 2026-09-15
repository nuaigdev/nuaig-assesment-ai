"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/ui/local-time";
import type { JoinSession } from "@/lib/join/resolve";

type Step = "welcome" | "consent" | "device";

const WAITING_POLL_MS = 30_000;

function StepCard({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="space-y-6 rounded-md border border-border bg-surface p-6 shadow-panel sm:p-8">
      <p className="text-xs font-medium text-fg-muted">Step {step} of 3</p>
      {children}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

/**
 * The interviewee's steps (spec §11.10). Phase 1 covers welcome and consent; the device check
 * and call arrive in Phase 2. `waiting` means it is more than 15 minutes before the start,
 * so the page refreshes itself until the interviewee can continue.
 */
export function JoinFlow({ session, waiting }: { session: JoinSession; waiting: boolean }) {
  const [step, setStep] = useState<Step>("welcome");
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => router.refresh(), WAITING_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, router]);

  // Move focus to the new step's heading so screen readers announce the change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  if (step === "welcome") {
    return (
      <StepCard step={1}>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.02em] text-fg outline-none">
          You’re joining an assessment interview with {session.organizationName}
        </h1>
        <dl className="grid gap-4 rounded-md bg-surface-sunken p-4 sm:grid-cols-2">
          {session.intervieweeName && <Detail label="For">{session.intervieweeName}</Detail>}
          <Detail label="Department">{session.department}</Detail>
          <Detail label="Expected length">About {session.expectedMinutes} minutes</Detail>
          {session.scheduledAt && (
            <Detail label="Scheduled">
              <LocalTime iso={session.scheduledAt} />
            </Detail>
          )}
        </dl>
        {waiting ? (
          <div role="status" className="rounded-md border border-border px-4 py-3">
            <p className="font-medium text-fg">You’re a little early</p>
            <p className="mt-1 text-sm text-fg-muted">
              You can join from 15 minutes before the start. Keep this page open; it updates on its own.
            </p>
          </div>
        ) : (
          <Button className="w-full sm:w-auto" onClick={() => setStep("consent")}>
            Continue
          </Button>
        )}
      </StepCard>
    );
  }

  if (step === "consent") {
    return (
      <StepCard step={2}>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.02em] text-fg outline-none">
          Before you join
        </h1>
        {/* DECISION NEEDED (spec §18.1): final consent wording, reviewed against state recording-notice norms. */}
        <div className="space-y-4 rounded-md border border-border p-4 text-sm text-fg">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              This interview is conducted by an <strong>AI interviewer</strong> on behalf of NuAIg.
            </li>
            <li>
              The conversation is <strong>recorded and transcribed</strong>. NuAIg uses the transcript to prepare its
              assessment for {session.organizationName}.
            </li>
            <li>
              <strong>NuAIg team members may be listening live.</strong> They can’t be heard, and you’ll always see who
              is on the call.
            </li>
            <li>
              The interview is about processes and operations. Please don’t share personal health information about
              residents or patients.
            </li>
          </ul>
          {session.team.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-fg-muted">NuAIg team members who may listen</p>
              <ul className="mt-1.5 space-y-1">
                {session.team.map((member, index) => (
                  <li key={`${member.name}-${index}`}>{member.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setStep("welcome")}>
            Back
          </Button>
          <Button onClick={() => setStep("device")}>I understand, continue</Button>
        </div>
      </StepCard>
    );
  }

  return (
    <StepCard step={3}>
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.02em] text-fg outline-none">
        Microphone check
      </h1>
      <p className="text-sm text-fg-muted">
        The microphone check and the call open here. This part of the portal is still being set up; the NuAIg consultant
        who sent your link will let you know when the interview is ready to take.
      </p>
      <Button variant="ghost" onClick={() => setStep("consent")}>
        Back
      </Button>
    </StepCard>
  );
}
