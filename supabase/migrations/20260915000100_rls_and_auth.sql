-- Row Level Security (spec §8).
--
-- Supabase Auth is not used. The app authenticates staff with Microsoft, then signs a
-- short-lived Supabase access token per request (sub = users.id, role = authenticated)
-- with a signing key imported into the project. auth.uid() therefore returns users.id,
-- and these policies apply exactly as they would with Supabase Auth.
--
-- RLS is the floor; app guards are UX on top. Interviewees never authenticate: their
-- access goes through server routes using the service role, so `anon` gets nothing.

-- Helpers ----------------------------------------------------------------------------
-- SECURITY DEFINER so policies on `users` can consult `users` without recursing.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and u.is_active
  );
$$;

create function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.is_active
  );
$$;

create function public.is_assigned(target_interview uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.interview_participants ip
    join public.users u on u.id = ip.user_id
    where ip.interview_id = target_interview
      and ip.user_id = auth.uid()
      and u.is_active
  );
$$;

create function public.is_steward(target_interview uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.interview_participants ip
    join public.users u on u.id = ip.user_id
    where ip.interview_id = target_interview
      and ip.user_id = auth.uid()
      and ip.role = 'steward'
      and u.is_active
  );
$$;

-- Lock out anon entirely -----------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Enable RLS everywhere ---------------------------------------------------------------

alter table users                  enable row level security;
alter table organizations          enable row level security;
alter table contacts               enable row level security;
alter table assessments            enable row level security;
alter table templates              enable row level security;
alter table interviews             enable row level security;
alter table interview_participants enable row level security;
alter table transcript_entries     enable row level security;
alter table steward_notes          enable row level security;
alter table recordings             enable row level security;
alter table invitations            enable row level security;
alter table knowledge_documents    enable row level security;
alter table knowledge_chunks       enable row level security;
alter table audit_log              enable row level security;

-- Admin: full access to every table ------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'organizations', 'contacts', 'assessments', 'templates', 'interviews',
    'interview_participants', 'transcript_entries', 'steward_notes', 'recordings',
    'invitations', 'knowledge_documents', 'knowledge_chunks'
  ] loop
    execute format(
      'create policy "admins see everything" on %I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

-- The audit log is append-only: admins read it, writes go through the service role.
create policy "admins read audit log" on audit_log for select to authenticated
  using (public.is_admin());

-- Users -------------------------------------------------------------------------------
-- Name and sign-in fields are written by the sign-in route (service role); staff have no
-- self-service updates because Microsoft is the source of truth for name and email.

create policy "read own user" on users for select to authenticated
  using (id = auth.uid());

-- Active staff can see teammates (rosters, participant avatars).
create policy "staff read teammates" on users for select to authenticated
  using (public.is_active_staff());

-- §11.9: never demote, deactivate or delete the last active admin — whoever is asking.
create function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.users u
       where u.id <> old.id and u.role = 'admin' and u.is_active
     ) then
    raise exception 'cannot remove the last active admin'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger users_guard_last_admin
  before update or delete on users
  for each row execute function public.guard_last_admin();

-- Members: read what their assigned interviews reference -------------------------------

create policy "members see assigned" on interviews for select to authenticated
  using (public.is_assigned(id));

create policy "members see assigned rosters" on interview_participants for select to authenticated
  using (public.is_assigned(interview_id));

create policy "members see assigned transcripts" on transcript_entries for select to authenticated
  using (public.is_assigned(interview_id));

create policy "members see assigned steward notes" on steward_notes for select to authenticated
  using (public.is_assigned(interview_id));

create policy "stewards add notes" on steward_notes for insert to authenticated
  with check (user_id = auth.uid() and public.is_steward(interview_id));

create policy "members see assigned recordings" on recordings for select to authenticated
  using (public.is_assigned(interview_id));

create policy "members see assigned organizations" on organizations for select to authenticated
  using (exists (
    select 1 from interviews i
    where i.organization_id = organizations.id and public.is_assigned(i.id)
  ));

create policy "members see assigned assessments" on assessments for select to authenticated
  using (exists (
    select 1 from interviews i
    where i.assessment_id = assessments.id and public.is_assigned(i.id)
  ));

create policy "members see assigned contacts" on contacts for select to authenticated
  using (exists (
    select 1 from interviews i
    where i.contact_id = contacts.id and public.is_assigned(i.id)
  ));

create policy "members see assigned templates" on templates for select to authenticated
  using (exists (
    select 1 from interviews i
    where i.template_id = templates.id and public.is_assigned(i.id)
  ));

-- invitations, knowledge_*, audit_log: admin-only (policies above).
