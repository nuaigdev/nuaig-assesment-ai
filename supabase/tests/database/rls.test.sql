-- RLS acceptance tests. Run with: pnpm db:test   (hosted project; always rolled back)
--
-- request.jwt.claims mimics the access token the app signs for each request
-- (src/lib/supabase/token.ts): sub = users.id, role = authenticated.
-- Fixtures use @nuaig.test emails and fixed ids, so assertions hold even when the project
-- already has real data.
begin;
select plan(16);

-- Fixtures (as postgres, bypassing RLS) ----------------------------------------------

insert into users (id, email, role, is_active) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@nuaig.test', 'admin', true),
  ('00000000-0000-0000-0000-0000000000b1', 'member1@nuaig.test', 'member', true),
  ('00000000-0000-0000-0000-0000000000b2', 'member2@nuaig.test', 'member', true),
  ('00000000-0000-0000-0000-0000000000b3', 'former@nuaig.test', 'member', false);

-- Make the fixture admin the only active admin for the last-admin test (rolled back).
update users set is_active = false where email not like '%@nuaig.test';

insert into organizations (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Meadowbrook', 'meadowbrook-rls-test');
insert into assessments (id, organization_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'FY26');
insert into interviews (id, assessment_id, organization_id, title, department) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'Finance', 'Finance'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'HR', 'HR');
insert into interview_participants (interview_id, user_id, role) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'steward'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 'observer'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b3', 'observer');
insert into transcript_entries (interview_id, seq, speaker, content) values
  ('30000000-0000-0000-0000-000000000001', 1, 'agent', 'Finance question'),
  ('30000000-0000-0000-0000-000000000002', 1, 'agent', 'HR question');

-- Member 1 ------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select results_eq(
  'select id from interviews',
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$,
  'member sees only their assigned interview'
);
select is_empty(
  $$select 1 from interviews where id = '30000000-0000-0000-0000-000000000002'$$,
  'member cannot read another member''s interview'
);
select results_eq(
  'select content from transcript_entries',
  $$values ('Finance question')$$,
  'member reads only assigned transcripts'
);
select is(
  (select count(*)::int from organizations), 1,
  'member sees only the organisation of an assigned interview'
);
select is_empty('select 1 from invitations', 'member cannot read magic links');
select is_empty('select 1 from audit_log', 'member cannot read the audit log');
select throws_ok(
  $$insert into organizations (name, slug) values ('Nope', 'nope')$$,
  '42501', null, 'member cannot create organisations'
);
select lives_ok(
  $$update users set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'member role update runs...'
);
select is(
  (select role::text from users where id = '00000000-0000-0000-0000-0000000000b1'), 'member',
  '...but changes nothing: members cannot promote themselves'
);
select lives_ok(
  $$insert into steward_notes (interview_id, user_id, content)
    values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'probe deeper')$$,
  'steward can add a note on their interview'
);
select throws_ok(
  $$insert into steward_notes (interview_id, user_id, content)
    values ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'sneaky')$$,
  '42501', null, 'member cannot steer an interview they are not stewarding'
);

-- Deactivated and unknown principals ---------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select is_empty('select 1 from interviews', 'deactivated user reads nothing, even when assigned');

set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
select is_empty('select 1 from interviews', 'token for someone not in users reads nothing');

-- Admin -----------------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from interviews
   where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  2,
  'admin sees every interview'
);
select throws_ok(
  $$update users set role = 'member' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'the last active admin cannot demote themselves'
);

-- Anon ----------------------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok('select 1 from interviews', '42501', null, 'anon has no table access');

select * from finish();
rollback;
