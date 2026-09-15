import type { Metadata } from "next";

import { SelectField, TextField } from "@/components/forms/fields";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { FormDialog } from "@/components/forms/form-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/supabase/types";

import { inviteTeamMember, setTeamMemberActive, setTeamMemberRole } from "./actions";

export const metadata: Metadata = { title: "Team" };

function statusOf(user: AppUser): { label: string; tone: "ok" | "muted" | "brand" } {
  if (!user.is_active) return { label: "Deactivated", tone: "muted" };
  if (!user.microsoft_oid) return { label: "Invited", tone: "brand" };
  return { label: "Active", tone: "ok" };
}

/** NuAIg team members (spec §11.9). Access is granted by email; everyone signs in with Microsoft. */
export default async function TeamPage() {
  const admin = await requireAdmin();
  const db = createUserClient(admin.id);

  const [usersResult, assignmentsResult] = await Promise.all([
    db
      .from("users")
      .select("*")
      .order("is_active", { ascending: false })
      .order("full_name", { nullsFirst: false })
      .order("email"),
    db.from("interview_participants").select("user_id").not("user_id", "is", null),
  ]);

  const users = must(usersResult, "Team");
  const assignmentCounts = new Map<string, number>();
  for (const { user_id } of must(assignmentsResult, "Assignments")) {
    if (user_id) assignmentCounts.set(user_id, (assignmentCounts.get(user_id) ?? 0) + 1);
  }
  const activeAdmins = users.filter((user) => user.role === "admin" && user.is_active).length;

  return (
    <>
      <PageHeader
        title="Team"
        description="NuAIg staff who can use the portal. Access is granted by email; everyone signs in with their NuAIg Microsoft account."
        actions={
          <FormDialog
            triggerLabel="Invite member"
            title="Invite team member"
            description="They sign in with the Microsoft account that uses this email. No invitation email is sent; let them know the portal address."
            action={inviteTeamMember}
            submitLabel="Grant access"
          >
            <TextField name="email" type="email" label="Work email" required autoComplete="off" maxLength={254} />
            <SelectField name="role" label="Role" defaultValue="member">
              <option value="member">Team member: assigned interviews only</option>
              <option value="admin">Admin: everything, including clients, team and audit log</option>
            </SelectField>
          </FormDialog>
        }
      />

      <Table>
        <caption className="sr-only">Team members</caption>
        <THead>
          <tr>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH align="right">Interviews</TH>
            <TH align="right">Last sign-in</TH>
            <TH align="right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {users.map((user) => {
            const status = statusOf(user);
            const isSelf = user.id === admin.id;
            const isLastAdmin = user.role === "admin" && user.is_active && activeAdmins === 1;
            const displayName = user.full_name ?? user.email;
            return (
              <TR key={user.id}>
                <TD>
                  <div className="flex items-center gap-2.5 py-1.5">
                    <Avatar name={user.full_name} email={user.email} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">
                        {user.full_name ?? "Not signed in yet"}
                        {isSelf && <span className="ml-1.5 text-xs font-normal text-fg-muted">(you)</span>}
                      </p>
                      <p className="truncate text-[13px] text-fg-muted">{user.email}</p>
                    </div>
                  </div>
                </TD>
                <TD className="text-fg-muted">{user.role === "admin" ? "Admin" : "Team member"}</TD>
                <TD>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </TD>
                <TD align="right" className="text-fg-muted">
                  {assignmentCounts.get(user.id) ?? 0}
                </TD>
                <TD align="right" className="text-fg-muted">
                  {user.last_sign_in_at ? <LocalTime iso={user.last_sign_in_at} /> : "Never"}
                </TD>
                <TD align="right">
                  {isLastAdmin ? (
                    <span className="text-[13px] text-fg-muted">Last admin</span>
                  ) : (
                    <div className="flex justify-end gap-1">
                      {user.is_active &&
                        (user.role === "admin" ? (
                          <ConfirmAction
                            triggerLabel="Make member"
                            triggerVariant="ghost"
                            title={`Make ${displayName} a team member?`}
                            description={
                              isSelf
                                ? "You’ll lose admin access immediately and see only interviews you’re assigned to."
                                : "They’ll see only interviews they’re assigned to, and lose access to clients, team and the audit log."
                            }
                            confirmLabel="Change role"
                            action={setTeamMemberRole.bind(null, user.id, "member")}
                          />
                        ) : (
                          <ConfirmAction
                            triggerLabel="Make admin"
                            triggerVariant="ghost"
                            title={`Make ${displayName} an admin?`}
                            description="Admins can see every interview, transcript and recording, and manage clients, templates and the team."
                            confirmLabel="Make admin"
                            action={setTeamMemberRole.bind(null, user.id, "admin")}
                          />
                        ))}
                      {user.is_active ? (
                        <ConfirmAction
                          triggerLabel="Deactivate"
                          triggerVariant="ghost"
                          title={`Deactivate ${displayName}?`}
                          description="They’re signed out on their next request and can’t sign in again until reactivated. Their past work stays in the record."
                          confirmLabel="Deactivate"
                          destructive
                          action={setTeamMemberActive.bind(null, user.id, false)}
                        />
                      ) : (
                        <ConfirmAction
                          triggerLabel="Reactivate"
                          triggerVariant="ghost"
                          title={`Reactivate ${displayName}?`}
                          description="They can sign in again with their Microsoft account."
                          confirmLabel="Reactivate"
                          action={setTeamMemberActive.bind(null, user.id, true)}
                        />
                      )}
                    </div>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </>
  );
}
