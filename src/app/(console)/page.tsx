import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";

import { AdminDashboard } from "./_components/admin-dashboard";
import { MemberDashboard } from "./_components/member-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  return user.role === "admin" ? (
    <AdminDashboard userId={user.id} />
  ) : (
    <MemberDashboard userId={user.id} />
  );
}
