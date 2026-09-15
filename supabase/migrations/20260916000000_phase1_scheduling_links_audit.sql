-- Phase 1 (spec §14): scheduling, team assignment, magic links, rate limiting, audit trail.
--
-- Multi-step changes live in SECURITY INVOKER functions so they run in one transaction
-- while RLS still applies to the caller. Audit entries are written by triggers, so no code
-- path can forget them; the actor is auth.uid() (null for service-role/system changes).

-- Participants -------------------------------------------------------------------------

-- Staff rows are stewards/observers; interviewee/agent rows (Phase 2+) have no user.
alter table interview_participants
  add constraint interview_participants_staff_roles
  check ((role in ('steward', 'observer')) = (user_id is not null));

-- At most one steward per interview. Deferred so a team edit can swap roles in one statement.
alter table interview_participants
  add constraint interview_participants_one_steward
  exclude using btree (interview_id with =) where (role = 'steward')
  deferrable initially deferred;

-- Magic links (§7.4) --------------------------------------------------------------------

alter table invitations
  add constraint invitations_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$');

-- One active (unrevoked) link per interview; reissuing revokes the previous one first.
create unique index invitations_one_active_per_interview
  on invitations (interview_id) where revoked_at is null;

-- Rate limiting (§7.4: "rate-limit the join route by IP") ------------------------------
-- Fixed-window counters in Postgres, because serverless instances share no memory.

create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;  -- no policies: service role only
revoke all on rate_limits from anon, authenticated;

create function public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Opportunistic cleanup keeps the table small without a scheduled job.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;

-- Audit trail (§7.6) -----------------------------------------------------------------------

create function public.audit_event(
  p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, action, entity_type, entity_id, metadata)
  values ((select u.id from public.users u where u.id = auth.uid()),
          p_action, p_entity_type, p_entity_id, p_metadata);
$$;

revoke execute on function public.audit_event(text, text, uuid, jsonb) from public, anon, authenticated;

create function public.audit_users() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_event('user.invited', 'user', new.id,
      jsonb_build_object('email', new.email, 'role', new.role));
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform public.audit_event('user.role_changed', 'user', new.id,
        jsonb_build_object('email', new.email, 'from', old.role, 'to', new.role));
    end if;
    if new.is_active is distinct from old.is_active then
      perform public.audit_event(
        case when new.is_active then 'user.reactivated' else 'user.deactivated' end,
        'user', new.id, jsonb_build_object('email', new.email));
    end if;
  else
    perform public.audit_event('user.deleted', 'user', old.id,
      jsonb_build_object('email', old.email));
  end if;
  return null;
end;
$$;

create trigger users_audit
  after insert or update of role, is_active or delete on users
  for each row execute function public.audit_users();

create function public.audit_organizations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_event('client.created', 'organization', new.id,
      jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.audit_event(
      case when new.is_active then 'client.reactivated' else 'client.deactivated' end,
      'organization', new.id, jsonb_build_object('name', new.name));
  else
    perform public.audit_event('client.deleted', 'organization', old.id,
      jsonb_build_object('name', old.name));
  end if;
  return null;
end;
$$;

create trigger organizations_audit_insert_delete
  after insert or delete on organizations
  for each row execute function public.audit_organizations();

create trigger organizations_audit_status
  after update of is_active on organizations
  for each row when (new.is_active is distinct from old.is_active)
  execute function public.audit_organizations();

create function public.audit_assessments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.audit_event('assessment.created', 'assessment', new.id,
    jsonb_build_object('name', new.name, 'organization_id', new.organization_id));
  return null;
end;
$$;

create trigger assessments_audit
  after insert on assessments
  for each row execute function public.audit_assessments();

create function public.audit_interviews() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_event('interview.created', 'interview', new.id,
      jsonb_build_object('title', new.title, 'scheduled_at', new.scheduled_at));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.audit_event('interview.status_changed', 'interview', new.id,
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.scheduled_at is distinct from old.scheduled_at then
      perform public.audit_event('interview.rescheduled', 'interview', new.id,
        jsonb_build_object('from', old.scheduled_at, 'to', new.scheduled_at));
    end if;
  else
    perform public.audit_event('interview.deleted', 'interview', old.id,
      jsonb_build_object('title', old.title));
  end if;
  return null;
end;
$$;

create trigger interviews_audit
  after insert or update of status, scheduled_at or delete on interviews
  for each row execute function public.audit_interviews();

create function public.audit_interview_participants() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.interview_participants := case when tg_op = 'DELETE' then old else new end;
  v_email text;
begin
  if v_row.user_id is null then
    return null;
  end if;
  select u.email into v_email from public.users u where u.id = v_row.user_id;

  if tg_op = 'INSERT' then
    perform public.audit_event('interview.participant_added', 'interview', new.interview_id,
      jsonb_build_object('user_id', new.user_id, 'email', v_email, 'role', new.role));
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform public.audit_event('interview.participant_role_changed', 'interview', new.interview_id,
        jsonb_build_object('user_id', new.user_id, 'email', v_email, 'from', old.role, 'to', new.role));
    end if;
  else
    perform public.audit_event('interview.participant_removed', 'interview', old.interview_id,
      jsonb_build_object('user_id', old.user_id, 'email', v_email, 'role', old.role));
  end if;
  return null;
end;
$$;

create trigger interview_participants_audit
  after insert or update of role or delete on interview_participants
  for each row execute function public.audit_interview_participants();

create function public.audit_invitations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_event('invitation.issued', 'interview', new.interview_id,
      jsonb_build_object('invitation_id', new.id, 'expires_at', new.expires_at));
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform public.audit_event('invitation.revoked', 'interview', new.interview_id,
      jsonb_build_object('invitation_id', new.id));
  end if;
  return null;
end;
$$;

create trigger invitations_audit
  after insert or update of revoked_at on invitations
  for each row execute function public.audit_invitations();

-- Scheduling (SECURITY INVOKER: RLS decides who may do this — admins today) --------------

create function public.set_interview_team(p_interview_id uuid, p_team jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_status public.interview_status;
  v_team jsonb := coalesce(p_team, '[]'::jsonb);
begin
  select i.status into v_status from public.interviews i where i.id = p_interview_id;
  if v_status is null then
    raise exception 'Interview not found.' using errcode = 'P0002';
  end if;
  if v_status not in ('scheduled', 'ready') then
    raise exception 'The team can only be changed before the interview starts.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_team) <> 'array' then
    raise exception 'The team must be a list.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_team) t
    where t->>'role' is null or t->>'role' not in ('steward', 'observer')
  ) then
    raise exception 'Team roles must be steward or observer.' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_team) t where t->>'role' = 'steward') > 1 then
    raise exception 'An interview can have only one steward.' using errcode = '22023';
  end if;
  if (select count(distinct t->>'user_id') from jsonb_array_elements(v_team) t)
     <> jsonb_array_length(v_team) then
    raise exception 'Each person can be assigned only once.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_team) t
    where not exists (
      select 1 from public.users u where u.id = (t->>'user_id')::uuid and u.is_active
    )
  ) then
    raise exception 'Only active NuAIg team members can be assigned.' using errcode = '22023';
  end if;

  delete from public.interview_participants ip
  where ip.interview_id = p_interview_id
    and ip.user_id is not null
    and not exists (
      select 1 from jsonb_array_elements(v_team) t where (t->>'user_id')::uuid = ip.user_id
    );

  insert into public.interview_participants as ip (interview_id, user_id, role)
  select p_interview_id, (t->>'user_id')::uuid, (t->>'role')::public.participant_role
  from jsonb_array_elements(v_team) t
  on conflict (interview_id, user_id) do update
    set role = excluded.role
    where ip.role is distinct from excluded.role;
end;
$$;

create function public.create_interview(
  p_assessment_id uuid,
  p_department text,
  p_scheduled_at timestamptz,
  p_team jsonb default '[]'::jsonb,
  p_contact_id uuid default null,
  p_template_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_organization_id uuid;
  v_organization_name text;
  v_interview_id uuid;
begin
  select a.organization_id, o.name
    into v_organization_id, v_organization_name
  from public.assessments a
  join public.organizations o on o.id = a.organization_id
  where a.id = p_assessment_id;

  if v_organization_id is null then
    raise exception 'Assessment not found.' using errcode = 'P0002';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = p_contact_id and c.organization_id = v_organization_id
  ) then
    raise exception 'That interviewee belongs to a different client.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_department, '')) = '' then
    raise exception 'Enter the department.' using errcode = '22023';
  end if;

  insert into public.interviews (
    assessment_id, organization_id, contact_id, template_id,
    title, department, scheduled_at, created_by
  ) values (
    p_assessment_id, v_organization_id, p_contact_id, p_template_id,
    btrim(p_department) || ' — ' || v_organization_name, btrim(p_department), p_scheduled_at, auth.uid()
  )
  returning id into v_interview_id;

  perform public.set_interview_team(v_interview_id, p_team);
  return v_interview_id;
end;
$$;

-- Join links -------------------------------------------------------------------------------

create function public.issue_invitation(p_interview_id uuid, p_token_hash text, p_expires_at timestamptz)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_status public.interview_status;
  v_invitation_id uuid;
begin
  select i.status into v_status from public.interviews i where i.id = p_interview_id;
  if v_status is null then
    raise exception 'Interview not found.' using errcode = 'P0002';
  end if;
  if v_status not in ('scheduled', 'ready', 'live') then
    raise exception 'Join links can only be issued for upcoming or live interviews.' using errcode = '22023';
  end if;
  if p_expires_at <= now() then
    raise exception 'The link would already be expired.' using errcode = '22023';
  end if;

  update public.invitations
     set revoked_at = now()
   where interview_id = p_interview_id and revoked_at is null;

  insert into public.invitations (interview_id, token_hash, expires_at, created_by)
  values (p_interview_id, p_token_hash, p_expires_at, auth.uid())
  returning id into v_invitation_id;

  update public.interviews set status = 'ready'
   where id = p_interview_id and status = 'scheduled';

  return v_invitation_id;
end;
$$;

create function public.revoke_invitation(p_interview_id uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.invitations
     set revoked_at = now()
   where interview_id = p_interview_id and revoked_at is null;
  if not found then
    raise exception 'There is no active join link to revoke.' using errcode = 'P0002';
  end if;

  update public.interviews set status = 'scheduled'
   where id = p_interview_id and status = 'ready';
end;
$$;

revoke execute on function public.set_interview_team(uuid, jsonb) from public, anon;
revoke execute on function public.create_interview(uuid, text, timestamptz, jsonb, uuid, uuid) from public, anon;
revoke execute on function public.issue_invitation(uuid, text, timestamptz) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.set_interview_team(uuid, jsonb) to authenticated;
grant execute on function public.create_interview(uuid, text, timestamptz, jsonb, uuid, uuid) to authenticated;
grant execute on function public.issue_invitation(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
