-- Initial schema — spec §7, with one deliberate change: NuAIg staff live in `users`
-- (the sign-in allow-list and role source) instead of `profiles` mirroring Supabase Auth.
-- Microsoft SSO only proves identity; this table decides access. See CLAUDE.md.

create extension if not exists vector;

-- §7.1 Enums ----------------------------------------------------------------

create type user_role        as enum ('admin', 'member');
create type interview_status as enum ('scheduled', 'ready', 'live', 'completed', 'cancelled', 'failed');
create type participant_role as enum ('interviewee', 'steward', 'observer', 'agent');
create type speaker_role     as enum ('agent', 'interviewee', 'system');
create type end_reason       as enum ('completed', 'time_cap', 'steward_stopped',
                                      'interviewee_left', 'inactivity', 'error');

-- §7.2 Core tables ------------------------------------------------------------

-- NuAIg staff. An admin adds a row (email + role) to grant access; sign-in with Microsoft
-- only succeeds for an active row whose email matches. On first sign-in the Microsoft
-- object id is bound, and later sign-ins match on it, so a recycled mailbox can't inherit access.
create table users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email = lower(email)),
  full_name       text,                -- refreshed from Microsoft on every sign-in
  role            user_role not null default 'member',
  is_active       boolean not null default true,
  microsoft_oid   text unique,         -- Entra object id, bound on first sign-in
  last_sign_in_at timestamptz,
  invited_by      uuid references users(id),
  created_at      timestamptz not null default now()
);

-- Client organisations (senior living providers).
create table organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  type         text,                 -- 'CCRC' | 'LTPAC' | 'Life Plan' | ...
  city         text,
  state        text,
  notes        text,
  is_active    boolean not null default true,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now()
);

-- People at the client who get interviewed. Not portal users.
create table contacts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  full_name        text not null,
  email            text,
  job_title        text,
  department       text not null,
  created_at       timestamptz not null default now()
);

-- An engagement with a client: the umbrella over many interviews.
create table assessments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  description      text,
  started_on       date,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now()
);

-- Question templates, versioned.
create table templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  department   text not null,
  description  text,
  version      int not null default 1,
  is_published boolean not null default false,
  -- [{ id, order, text, intent, required, max_followups, probe_hints[] }]
  questions    jsonb not null default '[]'::jsonb,
  config       jsonb not null default '{}'::jsonb,  -- time_cap_minutes, inactivity_seconds, ...
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One scheduled or completed interview session.
create table interviews (
  id                uuid primary key default gen_random_uuid(),
  assessment_id     uuid not null references assessments(id) on delete cascade,
  organization_id   uuid not null references organizations(id) on delete cascade,
  contact_id        uuid references contacts(id),
  template_id       uuid references templates(id),
  title             text not null,
  department        text not null,
  status            interview_status not null default 'scheduled',
  scheduled_at      timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  end_reason        end_reason,
  livekit_room      text unique,
  duration_seconds  int,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now()
);
create index on interviews (organization_id, status);
create index on interviews (scheduled_at desc);

-- Which NuAIg staff are on which interview, and in what capacity.
create table interview_participants (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  user_id       uuid references users(id) on delete cascade,  -- null for interviewee / agent
  role          participant_role not null,
  joined_at     timestamptz,
  left_at       timestamptz,
  unique (interview_id, user_id)
);
create index on interview_participants (user_id);

-- §7.3 Transcript, steering, recording ----------------------------------------

create table transcript_entries (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  seq           int not null,
  speaker       speaker_role not null,
  content       text not null,
  started_at_ms int,                 -- offset from interview start
  is_final      boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (interview_id, seq)
);
create index on transcript_entries (interview_id, seq);

-- Steward nudges. Kept separate so they can be excluded from client-facing exports.
create table steward_notes (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  user_id       uuid not null references users(id),
  content       text not null,
  applied_at    timestamptz,         -- when the agent actually used it
  at_ms         int,
  created_at    timestamptz not null default now()
);

create table recordings (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  storage_path  text not null,       -- Supabase Storage, private bucket
  duration_seconds int,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

-- §7.4 Magic links --------------------------------------------------------------

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  token_hash    text not null unique,   -- sha256 of the raw token. NEVER store raw.
  expires_at    timestamptz not null,
  first_used_at timestamptz,
  revoked_at    timestamptz,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);
create index on invitations (token_hash);

-- §7.5 Knowledge & RAG -----------------------------------------------------------

create table knowledge_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  kind         text not null,        -- 'domain' | 'past_assessment'
  department   text,
  organization_id uuid references organizations(id),  -- null for general domain knowledge
  storage_path text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now()
);

create table knowledge_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references knowledge_documents(id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);
create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- §7.6 Audit log ------------------------------------------------------------------

create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id),
  action       text not null,        -- 'interview.created', 'invitation.revoked', ...
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
create index on audit_log (created_at desc);

-- Housekeeping ---------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger templates_touch_updated_at
  before update on templates
  for each row execute function public.touch_updated_at();
