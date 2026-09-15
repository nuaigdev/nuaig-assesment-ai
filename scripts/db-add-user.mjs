#!/usr/bin/env node
// pnpm db:add-user <email> [admin|member] — grants a NuAIg staff member access (or updates
// their role and reactivates them). Their Microsoft account must use this email or UPN.
// Bootstraps the first admin; after Phase 1, admins manage staff from /team instead.
import { fail, loadEnv, managementApi, run } from "./lib/supabase-api.mjs";

run(async () => {
  const [emailArg, role = "member"] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !email.includes("@")) fail("Usage: pnpm db:add-user <email> [admin|member]");
  if (role !== "admin" && role !== "member") fail("Role must be admin or member.");

  const api = managementApi(loadEnv());
  const rows = await api.query(
    `with upserted as (
       insert into public.users (email, role)
       values ($1, $2::public.user_role)
       on conflict (email) do update set role = excluded.role, is_active = true
       returning id, email, role, is_active, microsoft_oid is not null as linked
     ), audited as (
       insert into public.audit_log (action, entity_type, entity_id, metadata)
       select 'user.granted', 'user', id, jsonb_build_object('email', email, 'role', role, 'via', 'db:add-user')
       from upserted
     )
     select * from upserted`,
    [email, role],
  );
  console.table(rows);
});
