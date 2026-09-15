-- Phase 3 (spec §14): live transcript and the agent's ElevenLabs conversation.
--
-- The agent worker never touches the database. It reports through the app's internal API,
-- which calls these service-role functions. Staff read transcripts through RLS, and receive
-- live changes over Supabase Realtime (postgres_changes respects the same policies).

-- Speech Engine tells the brain only a conversation id; this maps it back to the interview.
alter table interviews add column elevenlabs_conversation_id text unique;

-- Appends a transcript line. seq is allocated under a lock on the interview row, so lines from
-- concurrent requests never collide. started_at_ms is the offset from when the call went live.
create function public.append_transcript_entry(
  p_interview_id uuid,
  p_speaker public.speaker_role,
  p_content text,
  p_is_final boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_started_at timestamptz;
  v_seq int;
  v_entry_id uuid;
begin
  select i.started_at into v_started_at
    from public.interviews i
   where i.id = p_interview_id
     for update;
  if not found then
    raise exception 'Interview not found.' using errcode = 'P0002';
  end if;

  select coalesce(max(t.seq), 0) + 1 into v_seq
    from public.transcript_entries t
   where t.interview_id = p_interview_id;

  insert into public.transcript_entries (interview_id, seq, speaker, content, started_at_ms, is_final)
  values (
    p_interview_id,
    v_seq,
    p_speaker,
    p_content,
    case
      when v_started_at is null then 0
      else greatest(0, floor(extract(epoch from now() - v_started_at) * 1000))::int
    end,
    p_is_final
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- Replaces a line's text (e.g. an interrupted agent response) and optionally finalizes it.
-- A final line never goes back to interim.
create function public.update_transcript_entry(
  p_entry_id uuid,
  p_content text,
  p_is_final boolean default true
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.transcript_entries t
     set content = p_content,
         is_final = t.is_final or p_is_final
   where t.id = p_entry_id;
  if not found then
    raise exception 'Transcript entry not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.append_transcript_entry(uuid, public.speaker_role, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.update_transcript_entry(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.append_transcript_entry(uuid, public.speaker_role, text, boolean) to service_role;
grant execute on function public.update_transcript_entry(uuid, text, boolean) to service_role;

-- Teardown now also performs §13.1 step 2: every transcript line is final once the call ends.
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

  -- §13.1 step 2: flush — nothing stays interim after the call.
  update public.transcript_entries
     set is_final = true
   where interview_id = p_interview_id and not is_final;

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
grant execute on function public.finalize_interview(uuid, public.end_reason, boolean, uuid) to service_role;

-- Live transcript fan-out (spec §5: Realtime covers it; no custom WebSocket server).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transcript_entries'
  ) then
    alter publication supabase_realtime add table public.transcript_entries;
  end if;
end;
$$;
