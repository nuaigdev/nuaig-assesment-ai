-- Phase 3: transcript lines, realtime publication, conversation mapping, teardown flush.
-- Run with: pnpm db:test   (hosted project; always rolled back)
begin;
select plan(12);

-- Fixtures (as postgres) -----------------------------------------------------------------------

insert into users (id, email, role) values
  ('00000000-0000-0000-0000-00000000030a', 'p3-admin@nuaig.test', 'admin'),
  ('00000000-0000-0000-0000-0000000003b1', 'p3-observer@nuaig.test', 'member'),
  ('00000000-0000-0000-0000-0000000003b2', 'p3-outsider@nuaig.test', 'member');

insert into organizations (id, name, slug) values
  ('10000000-0000-0000-0000-000000000301', 'Phase Three Test Community', 'phase-three-test-community');
insert into assessments (id, organization_id, name) values
  ('20000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000301', 'Phase three');
insert into interviews (id, assessment_id, organization_id, title, department, status, started_at) values
  ('30000000-0000-0000-0000-000000000301', '20000000-0000-0000-0000-000000000301',
   '10000000-0000-0000-0000-000000000301', 'Finance — Phase Three', 'Finance', 'live', now() - interval '90 seconds');
insert into interview_participants (interview_id, user_id, role) values
  ('30000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000003b1', 'observer');

-- Appending (service role) ----------------------------------------------------------------------

select lives_ok(
  $$select append_transcript_entry('30000000-0000-0000-0000-000000000301', 'interviewee', 'We close the month in spreadsheets.')$$,
  'an interviewee line is appended'
);
select lives_ok(
  $$select append_transcript_entry('30000000-0000-0000-0000-000000000301', 'agent', 'How long does that take', false)$$,
  'an interim agent line is appended'
);
select results_eq(
  $$select seq, speaker::text from transcript_entries
     where interview_id = '30000000-0000-0000-0000-000000000301' order by seq$$,
  $$values (1, 'interviewee'), (2, 'agent')$$,
  'lines are numbered in order'
);
select ok(
  (select started_at_ms >= 89000 from transcript_entries
    where interview_id = '30000000-0000-0000-0000-000000000301' and seq = 1),
  'the offset is measured from when the call went live'
);
select lives_ok(
  $$select update_transcript_entry(
      (select id from transcript_entries where interview_id = '30000000-0000-0000-0000-000000000301' and seq = 2),
      'How long does that take each month?', true)$$,
  'an interim line is finalized with its full text'
);
select results_eq(
  $$select content, is_final from transcript_entries
     where interview_id = '30000000-0000-0000-0000-000000000301' and seq = 2$$,
  $$values ('How long does that take each month?', true)$$,
  'the finalized text and state are stored'
);
select throws_ok(
  $$select append_transcript_entry('99999999-9999-9999-9999-999999999999', 'agent', 'nope')$$,
  'P0002', null, 'appending to a missing interview fails'
);

-- Realtime and conversation mapping ----------------------------------------------------------------

select ok(
  exists (select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transcript_entries'),
  'transcript lines are published to Realtime'
);
select lives_ok(
  $$update interviews set elevenlabs_conversation_id = 'conv_test_phase3'
     where id = '30000000-0000-0000-0000-000000000301'$$,
  'an interview records its ElevenLabs conversation'
);

-- Access -------------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}';
select throws_ok(
  $$select append_transcript_entry('30000000-0000-0000-0000-000000000301', 'agent', 'forged line')$$,
  '42501', null, 'staff cannot write transcript lines directly'
);

-- Teardown flush -------------------------------------------------------------------------------------

reset role;
do $$ begin
  perform append_transcript_entry('30000000-0000-0000-0000-000000000301', 'agent', 'Thanks for your', false);
end $$;
select is(
  finalize_interview('30000000-0000-0000-0000-000000000301', 'completed')::text,
  'completed',
  'the interview finishes'
);
select is(
  (select count(*)::int from transcript_entries
    where interview_id = '30000000-0000-0000-0000-000000000301' and not is_final),
  0,
  'teardown marks every transcript line final'
);

select * from finish();
rollback;
