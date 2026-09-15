import type { Json } from "@/lib/supabase/types";

// Actions written by the audit triggers (Phase 1 migration) and by the sign-in route.
const ACTION_LABELS: Record<string, string> = {
  "user.invited": "Team member invited",
  "user.role_changed": "Role changed",
  "user.deactivated": "Team member deactivated",
  "user.reactivated": "Team member reactivated",
  "user.deleted": "Team member deleted",
  "user.microsoft_linked": "Microsoft account linked",
  "client.created": "Client created",
  "client.deactivated": "Client deactivated",
  "client.reactivated": "Client reactivated",
  "client.deleted": "Client deleted",
  "assessment.created": "Assessment created",
  "interview.created": "Interview scheduled",
  "interview.rescheduled": "Interview rescheduled",
  "interview.status_changed": "Status changed",
  "interview.deleted": "Interview deleted",
  "interview.participant_added": "Team member assigned",
  "interview.participant_removed": "Team member unassigned",
  "interview.participant_role_changed": "Team role changed",
  "invitation.issued": "Join link issued",
  "invitation.revoked": "Join link revoked",
};

export const AUDIT_ACTIONS = Object.keys(ACTION_LABELS);

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function auditEntityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "interview":
      return `/interviews/${entityId}`;
    case "organization":
      return `/clients/${entityId}`;
    case "assessment":
      return `/assessments/${entityId}`;
    case "user":
      return "/team";
    default:
      return null;
  }
}

function field(metadata: Json | null, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

const humanize = (value: string | null) => (value ? value.replace(/_/g, " ") : "");

/** One-line, human-readable detail for an audit entry. Dates are left as ISO for LocalTime. */
export function describeAuditEntry(action: string, metadata: Json | null): string {
  const email = field(metadata, "email");
  switch (action) {
    case "user.invited":
      return `${email} as ${field(metadata, "role")}`;
    case "user.role_changed":
      return `${email}: ${field(metadata, "from")} → ${field(metadata, "to")}`;
    case "interview.status_changed":
      return `${humanize(field(metadata, "from"))} → ${humanize(field(metadata, "to"))}`;
    case "interview.participant_added":
    case "interview.participant_removed":
      return `${email} (${field(metadata, "role")})`;
    case "interview.participant_role_changed":
      return `${email}: ${field(metadata, "from")} → ${field(metadata, "to")}`;
    case "interview.created":
    case "interview.deleted":
      return field(metadata, "title") ?? "";
    case "client.created":
    case "client.deactivated":
    case "client.reactivated":
    case "client.deleted":
    case "assessment.created":
      return field(metadata, "name") ?? "";
    default:
      return email ?? "";
  }
}
