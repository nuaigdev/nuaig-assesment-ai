-- Phase 2: call presence, going live, and the database step of the unified teardown.
-- Run with: pnpm db:test   (hosted project; always rolled back)
begin;
select plan(18);

-- Fixtures (as postgres) -----------------------------------------------------------------------

insert into users (id, email, role) values
  ('00000000-0000-0000-0000-00000000020a', 'p2-admin@nuaig.test', 'admin'),
  ('00000000-0000-0000-0000-0000000002b1', 'p2-steward@nuaig.test', 'member');

insert into organizations (id, name, slug) values
  ('10000000-0000-0000-0000-000000000201', 'Phase Two Test Community', 'phase-two-test-community');
insert into assessments (id, organization_id, name) values
  ('20000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000201', 'Phase two');
insert into interviews (id, assessment_id, organization_id, title, department, status, scheduled_at) values
  ('30000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000201',
   '10000000-0000-0000-0000-000000000201', 'Finance — Phase Two', 'Finance', 'ready', now()),
  ('30000000-0000-0000-0000-000000000202', '20000000-0000-0000-0000-000000000201',
   '10000000-0000-0000-0000-000000000201', 'HR — Phase Two', 'HR', 'ready', now());
insert into interview_participants (interview_id, user_id, role) values
  ('30000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000002b1', 'steward');
insert into invitations (interview_id, token_hash, expires_at) values
  ('30000000-0000-0000-0000-000000000201', repeat('d', 64), now() + interval '7 days');

-- Presence (service role) ----------------------------------------------------------------------

select lives_ok(
  $$select record_participant_presence('30000000-0000-0000-0000-000000000201', 'interviewee', null, true)$$,
  'the interviewee joining is recorded'
);
select is(
  (select status::text from interviews where id = '30000000-0000-0000-0000-000000000201'),
  'live',
  'the interview goes live when the interviewee joins'
);
select ok(
  (select started_at is not null from interviews where id = '30000000-0000-0000-0000-000000000201'),
  'the start time is recorded'
);
select lives_ok(
  $$select record_participant_presence('30000000-0000-0000-0000-000000000201', 'observer',
      '00000000-0000-0000-0000-0000000002b1', true)$$,
  'the steward joining is recorded'
);
select is(
  (select role::text from interview_participants
    where interview_id = '30000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-0000000002b1'),
  'steward',
  'joining keeps the assigned role'
);
select lives_ok(
  $$select record_participant_presence('30000000-0000-0000-0000-000000000201', 'observer',
      '00000000-0000-0000-0000-00000000020a', true)$$,
  'an unassigned admin joining is recorded'
);
select is(
  (select role::text from interview_participants
    where interview_id = '30000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-00000000020a'),
  'observer',
  'an unassigned admin is listed as an observer'
);
select lives_ok(
  $$select record_participant_presence('30000000-0000-0000-0000-000000000201', 'interviewee', null, false)$$,
  'the interviewee leaving is recorded'
);
select ok(
  (select left_at is not null from interview_participants
    where interview_id = '30000000-0000-0000-0000-000000000201' and role = 'interviewee'),
  'the leave time is recorded'
);
select lives_ok(
  $$select record_participant_presence('30000000-0000-0000-0000-000000000201', 'interviewee', null, true)$$,
  'the interviewee rejoins'
);
select ok(
  (select left_at is null from interview_participants
    where interview_id = '30000000-0000-0000-0000-000000000201' and role = 'interviewee'),
  'rejoining clears the leave time'
);
select throws_ok(
  $$select record_participant_presence('30000000-0000-0000-0000-000000000201', 'observer', null, true)$$,
  '22023', null, 'staff presence requires a user'
);

-- Teardown (service role) ----------------------------------------------------------------------

select is(
  finalize_interview('30000000-0000-0000-0000-000000000201', 'steward_stopped', false,
                     '00000000-0000-0000-0000-0000000002b1')::text,
  'completed',
  'a live interview ends as completed'
);
select ok(
  (select count(*) = 0 from invitations
    where interview_id = '30000000-0000-0000-0000-000000000201' and revoked_at is null)
  and (select count(*) = 0 from interview_participants
    where interview_id = '30000000-0000-0000-0000-000000000201' and joined_at is not null and left_at is null),
  'ending revokes the join link and marks everyone as left'
);
select is(
  (select user_id from audit_log
    where entity_id = '30000000-0000-0000-0000-000000000201'
      and action = 'interview.status_changed' and metadata->>'to' = 'completed'),
  '00000000-0000-0000-0000-0000000002b1'::uuid,
  'the staff member who ended the call is the audited actor'
);
select is(
  finalize_interview('30000000-0000-0000-0000-000000000201', 'steward_stopped')::text,
  null,
  'ending twice is a no-op'
);
select is(
  finalize_interview('30000000-0000-0000-0000-000000000202', 'steward_stopped')::text,
  'cancelled',
  'an interview that never went live ends as cancelled'
);

-- Staff cannot call either function directly -------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000020a","role":"authenticated"}';

select throws_ok(
  $$select finalize_interview('30000000-0000-0000-0000-000000000202', 'steward_stopped')$$,
  '42501', null, 'even admins cannot call the teardown function directly'
);

reset role;
select * from finish();
rollback;
