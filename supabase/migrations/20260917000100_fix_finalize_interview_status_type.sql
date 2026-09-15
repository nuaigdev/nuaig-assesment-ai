-- Fix: finalize_interview's CASE produced text, which Postgres refuses to assign to the
-- interview_status column (42804) — PL/pgSQL only checks this when the statement runs, so
-- 20260917000000 applied cleanly but failed on first call. Same behaviour, typed literals.

create or replace function public.finalize_interview(
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
                    when p_failed then 'failed'::public.interview_status
                    when i.started_at is null then 'cancelled'::public.interview_status
                    else 'completed'::public.interview_status
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

revoke execute on function public.finalize_interview(uuid, public.end_reason, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_interview(uuid, public.end_reason, boolean, uuid)
  to service_role;
