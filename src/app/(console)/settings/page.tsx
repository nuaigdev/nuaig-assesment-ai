import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-4 py-3">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-xl">
        <CardHeader
          title="Profile"
          description="Your name and email come from your NuAIg Microsoft account and refresh each time you sign in. Only an admin can change your role."
        />
        <dl className="divide-y divide-border px-5">
          <Row label="Name">{user.full_name ?? "—"}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role">{user.role === "admin" ? "Admin" : "Team member"}</Row>
          <Row label="Last sign-in">
            {user.last_sign_in_at ? <LocalTime iso={user.last_sign_in_at} /> : "—"}
          </Row>
        </dl>
      </Card>
    </>
  );
}
