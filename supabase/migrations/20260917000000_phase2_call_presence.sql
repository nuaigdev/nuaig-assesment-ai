-- Phase 2 (spec §14): live-call presence and the database step of the unified teardown (§13.1).
--
-- Both functions are SECURITY DEFINER and callable only by the service role: the app decides
-- who may join or end a call (interviewees have no database identity), then records the result.
-- p_actor, when given, becomes auth.uid() for the rest of the transaction so audit triggers
-- attribute the change to the staff member who caused it.

-- One interviewee row and (Phase 3) one agent row per interview; neither has a user.
create unique index interview_participants_one_per_nonstaff_role
  on interview_participants (interview_id, role) where user_id is null;

create function public.record_participant_presence(
  p_interview_id uuid,
  p_role public.participant_role,
  p_user_id uuid,
  p_present boolean,
  p_actor uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
begin
  if (p_user_id is null) <> (p_role in ('interviewee', 'agent')) then
    raise exception 'Staff presence needs a user; interviewee and agent presence must not have one.'
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.interviews i where i.id = p_interview_id) then
    raise exception 'Interview not found.' using errcode = 'P0002';
  end if;
  if p_actor is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_actor)::text, true);
  end if;

  if p_present then
    if p_user_id is null then
      insert into public.interview_participants as ip (interview_id, role, joined_at)
      values (p_interview_id, p_role, v_now)
      on conflict (interview_id, role) where user_id is null do update
        set joined_at = coalesce(ip.joined_at, v_now), left_at = null;
    else
      -- Staff keep their assigned role; an unassigned admin who joins is recorded as an observer.
      insert into public.interview_participants as ip (interview_id, user_id, role, joined_at)
      values (p_interview_id, p_user_id, p_role, v_now)
      on conflict (interview_id, user_id) do update
        set joined_at = coalesce(ip.joined_at, v_now), left_at = null;
    end if;
  else
    update public.interview_participants ip
       set left_at = v_now
     where ip.interview_id = p_interview_id
       and ip.role = p_role
       and ip.user_id is not distinct from p_user_id
       and ip.joined_at is not null
       and ip.left_at is null;
  end if;

  -- The call is live once the interviewee is actually in the room.
  if p_present and p_role = 'interviewee' then
    update public.interviews
       set status = 'live', started_at = coalesce(started_at, v_now)
     where id = p_interview_id and status = 'ready';
  end if;
end;
$$;

-- Records how a call ended. Idempotent: returns null if the interview had already finished.
-- An interview that never went live becomes 'cancelled' rather than 'completed'.
create function public.finalize_interview(
  p_interview_id uuid,
  p_reason public.end_reason,
  p_failed boolean default false,
  p_actor uuid default null
) returns public.interview_status
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_status public.interview_status;
begin
  if p_actor is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_actor)::text, true);
  end if;

  update public.interviews i
     set status = case
                    when p_failed then 'failed'
                    when i.started_at is null then 'cancelled'
                    else 'completed'
                  end,
         ended_at = v_now,
         end_reason = p_reason,
         duration_seconds = case
                              when i.started_at is not null
                                then greatest(0, floor(extract(epoch from v_now - i.started_at)))::int
                            end
   where i.id = p_interview_id and i.status in ('ready', 'live')
  returning i.status into v_status;

  if v_status is null then
    return null;
  end if;

  update public.interview_participants
     set left_at = v_now
   where interview_id = p_interview_id and joined_at is not null and left_at is null;

  -- §13.1 step 7: the magic link can't be used to rejoin a finished interview.
  update public.invitations
     set revoked_at = v_now
   where interview_id = p_interview_id and revoked_at is null;

  return v_status;
end;
$$;

revoke execute on function public.record_participant_presence(uuid, public.participant_role, uuid, boolean, uuid)
  from public, anon, authenticated;
revoke execute on function public.finalize_interview(uuid, public.end_reason, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.record_participant_presence(uuid, public.participant_role, uuid, boolean, uuid)
  to service_role;
grant execute on function public.finalize_interview(uuid, public.end_reason, boolean, uuid)
  to service_role;
