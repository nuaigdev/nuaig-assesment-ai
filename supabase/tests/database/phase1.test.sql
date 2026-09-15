-- Phase 1: scheduling functions, the one-steward rule, join links, rate limiting, audit trail.
-- Run with: pnpm db:test   (hosted project; always rolled back)
begin;
select plan(19);

-- Fixtures (as postgres, bypassing RLS) ----------------------------------------------

insert into users (id, email, role, is_active) values
  ('00000000-0000-0000-0000-00000000010a', 'p1-admin@nuaig.test', 'admin', true),
  ('00000000-0000-0000-0000-0000000001b1', 'p1-member1@nuaig.test', 'member', true),
  ('00000000-0000-0000-0000-0000000001b2', 'p1-member2@nuaig.test', 'member', true),
  ('00000000-0000-0000-0000-0000000001b3', 'p1-former@nuaig.test', 'member', false);

insert into organizations (id, name, slug) values
  ('10000000-0000-0000-0000-000000000101', 'Phase One Test Community', 'phase-one-test-community');
insert into assessments (id, organization_id, name) values
  ('20000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000101', 'Phase one');
insert into contacts (id, organization_id, full_name, department) values
  ('40000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000101', 'Maria Reyes', 'Finance');

-- Admin schedules an interview and manages its team -----------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000010a","role":"authenticated"}';

select lives_ok(
  $$select create_interview(
      p_assessment_id => '20000000-0000-0000-0000-000000000101',
      p_department => 'Finance',
      p_scheduled_at => now() + interval '1 day',
      p_team => '[{"user_id":"00000000-0000-0000-0000-0000000001b1","role":"steward"},{"user_id":"00000000-0000-0000-0000-0000000001b2","role":"observer"}]',
      p_contact_id => '40000000-0000-0000-0000-000000000101')$$,
  'admin schedules an interview with a team'
);
select is(
  (select title from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
  'Finance — Phase One Test Community',
  'the title is built from department and client'
);
select is(
  (select count(*)::int from interview_participants ip
     join interviews i on i.id = ip.interview_id
    where i.assessment_id = '20000000-0000-0000-0000-000000000101'),
  2,
  'both team members are assigned'
);
select is(
  (select count(*)::int from audit_log a
     join interviews i on i.id = a.entity_id
    where a.action = 'interview.created'
      and i.assessment_id = '20000000-0000-0000-0000-000000000101'
      and a.user_id = '00000000-0000-0000-0000-00000000010a'),
  1,
  'scheduling is audited with the admin as actor'
);
select throws_ok(
  $$select set_interview_team(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
      '[{"user_id":"00000000-0000-0000-0000-0000000001b1","role":"steward"},{"user_id":"00000000-0000-0000-0000-0000000001b2","role":"steward"}]')$$,
  '22023', null, 'an interview cannot have two stewards'
);
select throws_ok(
  $$select set_interview_team(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
      '[{"user_id":"00000000-0000-0000-0000-0000000001b3","role":"observer"}]')$$,
  '22023', null, 'deactivated staff cannot be assigned'
);
select lives_ok(
  $$select set_interview_team(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
      '[{"user_id":"00000000-0000-0000-0000-0000000001b1","role":"observer"},{"user_id":"00000000-0000-0000-0000-0000000001b2","role":"steward"}]')$$,
  'steward and observer can swap in one change'
);
select is(
  (select ip.user_id from interview_participants ip
     join interviews i on i.id = ip.interview_id
    where i.assessment_id = '20000000-0000-0000-0000-000000000101' and ip.role = 'steward'),
  '00000000-0000-0000-0000-0000000001b2'::uuid,
  'the new steward is recorded'
);

-- Join links ---------------------------------------------------------------------------------

select lives_ok(
  $$select issue_invitation(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
      repeat('a', 64), now() + interval '7 days')$$,
  'admin issues a join link'
);
select is(
  (select status::text from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
  'ready',
  'issuing a link marks the interview ready'
);
select lives_ok(
  $$select issue_invitation(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
      repeat('b', 64), now() + interval '7 days')$$,
  'admin reissues the link'
);
select is(
  (select count(*)::int from invitations v
     join interviews i on i.id = v.interview_id
    where i.assessment_id = '20000000-0000-0000-0000-000000000101' and v.revoked_at is null),
  1,
  'reissuing leaves exactly one active link'
);

-- Members --------------------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001b2","role":"authenticated"}';

select throws_ok(
  $$select issue_invitation(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
      repeat('c', 64), now() + interval '7 days')$$,
  '42501', null, 'members cannot issue join links, even for their own interview'
);
select throws_ok(
  $$select consume_rate_limit('test:phase1', 5, 60)$$,
  '42501', null, 'staff cannot call the rate limiter directly'
);

-- Admin revokes --------------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000010a","role":"authenticated"}';

select lives_ok(
  $$select revoke_invitation(
      (select id from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'))$$,
  'admin revokes the link'
);
select is(
  (select status::text from interviews where assessment_id = '20000000-0000-0000-0000-000000000101'),
  'scheduled',
  'revoking the only link returns the interview to scheduled'
);
select is(
  (select count(*)::int from audit_log a
     join interviews i on i.id = a.entity_id
    where a.action = 'invitation.revoked'
      and i.assessment_id = '20000000-0000-0000-0000-000000000101'),
  2,
  'the reissue and the explicit revoke are both audited'
);

-- Rate limiter (service role) --------------------------------------------------------------------

reset role;

select is(consume_rate_limit('test:phase1', 1, 60), true, 'the first request in a window is allowed');
select is(consume_rate_limit('test:phase1', 1, 60), false, 'requests over the limit are refused');

select * from finish();
rollback;
