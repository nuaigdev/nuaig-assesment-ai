import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env/server";

/** 32 random bytes, base64url-encoded (spec §7.4). */
export const JOIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateJoinToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored. The raw token exists once, in the link handed to the client. */
export function hashJoinToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function joinUrl(token: string): string {
  return new URL(`/join/${token}`, env.NEXT_PUBLIC_APP_URL).toString();
}

/**
 * Links expire INVITATION_EXPIRY_DAYS after the scheduled time, or after now if that is later.
 * DECISION NEEDED (spec §18.3): confirm the window; the 7-day default is the spec's proposal.
 */
export function invitationExpiry(scheduledAt: string | null, now: Date): Date {
  const base = Math.max(scheduledAt ? new Date(scheduledAt).getTime() : 0, now.getTime());
  return new Date(base + env.INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
