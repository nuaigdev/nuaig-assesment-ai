# NuAIg Assessment Interview Portal — Technical Specification

**Version:** 1.0
**Owner:** NuAIg LLC
**Build agent:** Claude Code
**Deployment:** NuAIg (Vercel + one always-on worker host)
**Interview deliverable:** meeting transcript (and recording). No analysis, scoring, or report generation in this build.

---

## 0. How to read this document

This spec is written to be handed directly to Claude Code. It is ordered so that each phase can be built, tested, and shipped independently:

- **§1–§3** — what we are building and why (read once).
- **§4–§6** — architecture, services, and the hard constraints. **Read before writing any code.**
- **§7** — data model (SQL DDL, ready to run).
- **§8** — roles and permissions.
- **§9–§12** — UI/UX: design system, route map, page-by-page specs, and the call interface.
- **§13** — stopping criteria.
- **§14** — phased build plan with acceptance criteria. **This is the work queue.**
- **§15–§18** — environment, costs, risks, open decisions.

Anything marked **MUST** is a hard requirement. Anything marked **Decision needed** is blocked on NuAIg input and should not be guessed.

---

## 1. Context

**NuAIg LLC** is an AI advisory and solutions company (founded 2020, HQ Edison, NJ) serving mid-to-large healthcare and senior-living providers. NuAIg specialises in aging services — LTPAC, CCRCs, and Life Plan Communities — has mapped 100+ operational processes across Finance, Admissions & Move-ins, HR, Operations, Marketing and Foundation, and runs an established AI Assessment practice.

Today that practice runs on human interviews: NuAIg consultants interview community staff department by department, probing each function in depth, then compile department-wise and organisation-wide assessment reports.

**This portal automates the interview stage.** A client staff member joins a browser link and is interviewed by an AI voice agent that adapts its questions from an assessment template, domain knowledge, and NuAIg's prior assessments. A NuAIg team member listens live and silently steers the agent through a private text channel. The transcript flows into NuAIg's existing reporting process unchanged.

### 1.1 Confirmed requirements

| # | Requirement |
|---|---|
| R1 | Human-like agent voice; the session **MUST** feel like a real call with seamless, low-latency audio. |
| R2 | One interviewee per call, joining by browser link — **no login, no signup, no install**. |
| R3 | NuAIg team members can join the call and **hear the live audio**, as listen-only participants. |
| R4 | A NuAIg steward steers the agent silently via text, invisible to the interviewee. |
| R5 | Adaptive questioning from templates, grounded in domain knowledge and past assessments. |
| R6 | Every call has explicit, deterministic stopping criteria. |
| R7 | Transcript is the deliverable. Recordings are retained for team review. |
| R8 | Audio only. No video in this build. |
| R9 | No PHI is discussed — processes and operations only. HIPAA data handling is out of scope. |
| R10 | Interface modelled on Microsoft Teams calling; clean, modern, minimal configuration. |
| R11 | Minimum services — services are added only where a requirement demands it. |

---

## 2. Roles

Three roles. Two authenticate through Microsoft SSO; one never authenticates at all.

### 2.1 Admin (NuAIg)

The operator of the platform. Full control.

- Manage client organisations and their contacts (the people to be interviewed).
- Create assessments (an engagement with a client) and schedule interviews within them.
- Assign NuAIg team members to interviews as steward or observer.
- Generate, reissue, and revoke client magic links.
- Author and edit assessment templates.
- Manage the domain knowledge base and upload past assessment reports.
- Access every transcript and recording across all clients.
- Manage NuAIg team members (invite, change role, deactivate).
- View the audit log.

### 2.2 Team member (NuAIg)

A consultant who participates in interviews.

- See only the interviews they are assigned to.
- Join an assigned interview as **steward** (listen-only audio + steering) or **observer** (listen-only audio).
- Read the live transcript during a call.
- Access transcripts and recordings for their assigned interviews.
- End a call they are stewarding.
- **Cannot** manage clients, team members, templates, or the knowledge base; cannot see other teams' interviews.

### 2.3 Client (interviewee)

The person being interviewed. Zero friction.

- Receives a magic link (email or shared by NuAIg).
- Opens the link → consent notice → microphone check → joins the call.
- Speaks with the agent. Hears the agent. Sees who else is on the call.
- **No account, no password, no download.**
- Has no access to transcripts, recordings, or any other part of the portal.

> **Transparency rule (MUST).** The client is always shown, before joining and in the roster during the call, that the session is recorded and that NuAIg team members may be listening. Observers are never hidden from the interviewee. Steering content is private; the *presence* of listeners is not.

---

## 3. What is explicitly out of scope

- Any analysis, scoring, summarisation, or report generation from transcripts.
- PHI handling, HIPAA controls, BAAs.
- Multi-party interviews (more than one interviewee speaking).
- Telephony / dial-in / SIP.
- Video.
- Client-facing accounts or a client portal.
- Multi-tenancy for other consultancies. This is an internal NuAIg tool.

---

## 4. Architecture

### 4.1 Why the audio flows through LiveKit

The requirement that NuAIg team members **hear** the live call (R3) determines the architecture.

If the interviewee's browser connected directly to the voice provider, the audio would be a private two-way pipe with no seam to tap — the team could read a transcript but never listen. Instead, all audio flows through a **LiveKit room**: a virtual space any number of participants can join, each publishing or subscribing to audio tracks. LiveKit is the accepted added service, and it is what makes live observation possible. It also absorbs NAT traversal and TURN relay, so NuAIg runs no media infrastructure.

### 4.2 The two-track audio model

**The client's voice is never voice-converted.** The room carries two independent audio tracks and only one is synthetic:

| Track | Source | Who hears it |
|---|---|---|
| **1 — Interviewee audio** | The client's real microphone. Raw human voice. | Agent worker (for transcription only), steward, observers |
| **2 — Agent audio** | ElevenLabs text-to-speech. The only AI audio in the room. | Interviewee, steward, observers |

The worker subscribes to Track 1 only to produce a transcript; reading it does not alter it. Observers subscribe to that **same original track** and hear the client exactly as they spoke. A listening team member hears both tracks mixed — client in their real voice, agent in the ElevenLabs voice — like silently sitting in on a phone call. Transcription runs on a side branch and does not delay or modify what observers hear.

### 4.3 System diagram

```
                        ┌──────────────── LiveKit room ─────────────────┐
  Client browser ──────▶│ publishes: mic audio (Track 1)                 │
  (magic link)   ◀──────│ subscribes: agent audio (Track 2)              │
                        │                                                │
  NuAIg steward  ◀──────│ subscribes: Track 1 + Track 2  (listen-only)   │
  NuAIg observer ◀──────│ subscribes: Track 1 + Track 2  (listen-only)   │
                        │                                                │
  Agent worker   ◀─────▶│ subscribes: Track 1 → publishes: Track 2       │
                        └───────────────────────┬────────────────────────┘
                                                │
                                   audio ⇅ WebSocket
                                                │
                                         ┌──────▼──────┐
                                         │ ElevenLabs  │  STT + TTS + turn detection
                                         └──────┬──────┘
                                    transcript  │  response text
                                                │
   ┌────────────────────────────────────────────▼──────────────────────────┐
   │  Next.js app on Vercel                                                │
   │  • assembles prompt: template + knowledge + RAG + steward nudge       │
   │  • calls Claude → next question                                       │
   │  • writes transcript + broadcasts live via Supabase Realtime          │
   │  • enforces stopping criteria                                         │
   └────────────────────────────────────┬──────────────────────────────────┘
                                        │
                          ┌─────────────▼─────────────┐
                          │ Supabase                  │
                          │ Postgres + pgvector       │
                          │ Auth (Microsoft SSO)      │
                          │ Storage (recordings)      │
                          │ Realtime (live fan-out)   │
                          └───────────────────────────┘
```

### 4.4 Flow of one turn

1. Interviewee speaks → real audio published to the LiveKit room as Track 1.
2. The agent worker (subscribed to Track 1, **pinned to the interviewee identity**) streams audio to ElevenLabs → transcript text.
3. Transcript is written to Supabase and broadcast over Supabase Realtime to steward and observers.
4. Server assembles the next-question prompt: template state + domain knowledge + RAG hits from past assessments + any pending steward nudge.
5. Claude returns the next question or follow-up as text.
6. Text streams to ElevenLabs → synthesized speech → published into the room as Track 2.
7. Interviewee and listeners hear it; the exchange is appended to the transcript, timestamped and role-labelled.

> **Speaker attribution is free by design.** The worker transcribes only the interviewee's track, so observers in the room never pollute the transcript, and steward input arrives only as text. No voice-fingerprint diarization is needed anywhere in this system.

---

## 5. Services

| Service | Responsibility | Runs where |
|---|---|---|
| **Next.js app** | Portal, admin console, call UI, API routes, agent brain orchestration, stopping criteria | **Vercel** |
| **Agent worker** | Joins the LiveKit room, bridges audio to ElevenLabs, publishes the agent voice track | **Always-on host** (see §6.1) |
| **LiveKit Cloud** | The room: multi-participant audio, listen-only subscribers, TURN/NAT traversal | Managed |
| **ElevenLabs** | Speech-to-text, human-like text-to-speech, turn detection | Managed |
| **Anthropic Claude** | Agent brain: adaptive next question | Managed API |
| **Supabase** | Postgres + pgvector, Auth (Microsoft SSO), Storage (recordings), Realtime (live transcript) | Managed |

**Deliberately avoided:** no separate STT vendor, no separate TTS vendor, no self-run TURN, no custom WebSocket server (Supabase Realtime covers it), no telephony, no video.

### 5.1 Why Supabase earns its place

Supabase collapses four things that would otherwise be separate: the Postgres database, pgvector for RAG, Microsoft SSO via its Azure auth provider, object storage for recordings, and Realtime for broadcasting live transcript lines to stewards and observers. Row Level Security also lets the team-member permission boundary (§8) be enforced in the database rather than only in application code.

---

## 6. Hard constraints

### 6.1 Vercel cannot host the agent worker (MUST)

Vercel functions are serverless and time-limited. The agent worker is a **persistent process** that holds a LiveKit room connection and an ElevenLabs WebSocket open for the entire duration of a call. It cannot run as a Vercel function.

**Deploy the worker separately** on an always-on host — Railway, Render, Fly.io, or a small VM. It is a small Node process; a minimal instance is sufficient. This is the only piece of infrastructure outside Vercel + Supabase.

```
Vercel          →  Next.js app (UI + API routes)          serverless, fine
Railway/Render  →  agent worker (LiveKit ⇄ ElevenLabs)    persistent, required
Supabase        →  database, auth, storage, realtime      managed
```

### 6.2 Other constraints

- **Secrets never reach the browser (MUST).** LiveKit, ElevenLabs, and Anthropic keys live server-side only. The browser receives short-lived, scoped LiveKit access tokens minted by an API route.
- **Listen-only is enforced server-side (MUST).** Observer and steward LiveKit tokens are minted with publish permissions disabled. Do not rely on the UI hiding a mute button.
- **iOS Safari.** Start audio inside a real user gesture (the Join button). Test on a physical iPhone early. If the React wrapper misbehaves, fall back to the plain client SDK.
- **Magic link tokens are hashed at rest (MUST).** Store a hash, never the raw token. See §7.4.
---

## 7. Data model

Postgres on Supabase. Run `create extension if not exists vector;` before the DDL below.

### 7.1 Enums

```sql
create type user_role        as enum ('admin', 'member');
create type interview_status as enum ('scheduled', 'ready', 'live', 'completed', 'cancelled', 'failed');
create type participant_role as enum ('interviewee', 'steward', 'observer', 'agent');
create type speaker_role     as enum ('agent', 'interviewee', 'system');
create type end_reason       as enum ('completed', 'time_cap', 'steward_stopped',
                                      'interviewee_left', 'inactivity', 'error');
```

### 7.2 Core tables

```sql
-- NuAIg staff. Mirrors auth.users; created on first SSO login.
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  avatar_url   text,
  role         user_role not null default 'member',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
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
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

-- People at the client who get interviewed.
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
  created_by       uuid references profiles(id),
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
  created_by   uuid references profiles(id),
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
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now()
);
create index on interviews (organization_id, status);
create index on interviews (scheduled_at desc);

-- Which NuAIg members are on which interview, and in what capacity.
create table interview_participants (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete cascade,
  role          participant_role not null,
  joined_at     timestamptz,
  left_at       timestamptz,
  unique (interview_id, profile_id)
);
```

### 7.3 Transcript, steering, recording

```sql
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
  profile_id    uuid not null references profiles(id),
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
```

### 7.4 Magic links

```sql
create table invitations (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  token_hash    text not null unique,   -- sha256 of the raw token. NEVER store raw.
  expires_at    timestamptz not null,
  first_used_at timestamptz,
  revoked_at    timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index on invitations (token_hash);
```

**Token rules (MUST):**
- Generate 32 bytes of cryptographic randomness, base64url-encoded. UUIDs alone are not sufficient entropy for a bearer credential.
- Store only `sha256(token)`. The raw token exists once, in the link handed to the client.
- Links expire — default 7 days after the scheduled time. **Decision needed:** confirm the window.
- A link is **reusable until it expires or is revoked**, so a client who drops can rejoin. Record `first_used_at` but do not burn the token on first use.
- Revoking sets `revoked_at`; the join route rejects immediately.
- Rate-limit the join route by IP to blunt token guessing.

### 7.5 Knowledge & RAG

```sql
create table knowledge_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  kind         text not null,        -- 'domain' | 'past_assessment'
  department   text,
  organization_id uuid references organizations(id),  -- null for general domain knowledge
  storage_path text,
  created_by   uuid references profiles(id),
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
```

### 7.6 Audit log

```sql
create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id),
  action       text not null,        -- 'interview.created', 'invitation.revoked', ...
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
```

Log at minimum: magic link issued/revoked, transcript exported, recording downloaded, role changed, interview deleted.

---

## 8. Permissions

Enforce in **both** places: Supabase RLS as the floor, application guards for UX.

| Capability | Admin | Member | Client |
|---|:---:|:---:|:---:|
| Manage organisations & contacts | ✅ | — | — |
| Create assessments & schedule interviews | ✅ | — | — |
| Assign team members to interviews | ✅ | — | — |
| Issue / revoke magic links | ✅ | — | — |
| Author templates | ✅ | — | — |
| Manage knowledge base & past assessments | ✅ | — | — |
| Manage NuAIg team members | ✅ | — | — |
| View audit log | ✅ | — | — |
| See **all** interviews | ✅ | — | — |
| See **assigned** interviews | ✅ | ✅ | — |
| Join call as steward / observer | ✅ | ✅ | — |
| Steer the agent (if steward) | ✅ | ✅ | — |
| End a live call | ✅ | ✅ | — |
| Read transcripts & recordings | all | assigned only | — |
| Join the call and speak | — | — | ✅ |

### 8.1 RLS sketch

```sql
alter table interviews enable row level security;

create policy "admins see everything" on interviews for all
  using (exists (select 1 from profiles p
                 where p.id = auth.uid() and p.role = 'admin' and p.is_active));

create policy "members see assigned" on interviews for select
  using (exists (select 1 from interview_participants ip
                 where ip.interview_id = interviews.id and ip.profile_id = auth.uid()));
```

Apply the same shape to `transcript_entries`, `steward_notes`, and `recordings` — scoped through `interview_id`. The client never authenticates, so they are never a Supabase principal; their access runs entirely through server-side validation of the magic link token.

---

## 9. Design system

### 9.1 Direction

Two surfaces with deliberately different temperatures:

- **The console** (admin and team pages) is light, quiet, and dense — a working tool. It gets out of the way.
- **The call** is a dark stage, modelled on Microsoft Teams, where the only things that matter are who is speaking and the controls.

The brand cyan is used as an accent, not a wash: active state, speaking indicator, primary action. Everything else is neutral. Restraint is the point — this is a tool NuAIg consultants use for hours, not a landing page.

### 9.2 Brand assets

Provided: `nuaig-logo.svg` (dark wordmark, for light surfaces) and `nuaig-logo-white.svg` (for dark surfaces). Native viewBox `0 0 362.5 150`.

Place both in `/public/brand/`. Use the white variant in the call stage and any dark header; the dark variant everywhere else. Never recolour the cyan glyph.

### 9.3 Tokens

```css
:root {
  /* Brand */
  --nuaig-cyan:      #069BDF;   /* accent, primary action, speaking ring */
  --nuaig-cyan-600:  #0585BE;   /* hover */
  --nuaig-cyan-050:  #E8F6FD;   /* tint background */
  --nuaig-ink:       #111111;   /* wordmark black */

  /* Console (light) */
  --bg:              #FBFCFD;
  --surface:         #FFFFFF;
  --surface-sunken:  #F4F6F8;
  --border:          #E3E8EE;
  --text:            #15191E;
  --text-muted:      #5C6875;
  --text-subtle:     #8A97A5;

  /* Call stage (dark) */
  --stage:           #15171A;
  --stage-raised:    #1E2126;
  --stage-hover:     #272B31;
  --stage-border:    #32373E;
  --stage-text:      #F2F5F8;
  --stage-muted:     #98A3AE;

  /* Status */
  --live:            #E4453A;   /* recording dot, leave button */
  --ok:              #178A5F;
  --warn:            #B7791F;

  /* Radii — three steps, used consistently */
  --r-sm: 6px;    /* inputs, small buttons */
  --r-md: 10px;   /* cards, panels */
  --r-lg: 16px;   /* participant tiles, control bar */

  /* Elevation — sparing */
  --shadow-panel: 0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06);
  --shadow-float: 0 8px 28px rgba(0,0,0,.28);
}
```

### 9.4 Typography

**Inter** (variable) for the entire interface, loaded via `next/font`. One family, used with real range — this is a dense operational tool, and a second display face would be decoration without a job. Set `font-feature-settings: 'cv05','ss01'; font-variant-numeric: tabular-nums;` so timers and durations do not jitter.

| Role | Size / weight | Notes |
|---|---|---|
| Page title | 24px / 600, tracking -0.02em | |
| Section heading | 16px / 600 | |
| Body | 14px / 400, line-height 1.55 | Console default |
| Secondary | 13px / 400, `--text-muted` | |
| Label | 12px / 500 | Sentence case, **not** all caps |
| Timer & duration | 13px / 500, tabular | |
| Participant name (stage) | 15px / 500 | |

### 9.5 Component conventions

- **Buttons.** Primary = solid cyan, white text. Secondary = white with `--border`. Destructive = solid `--live`. Ghost for tertiary. One primary action per view.
- **Cards.** `--surface`, 1px `--border`, `--r-md`, `--shadow-panel`. No shadow on nested elements.
- **Tables.** For interviews, clients, and team lists. Sticky header, 44px rows, zebra off, hover `--surface-sunken`. Right-align durations and dates.
- **Status pills.** Small, filled tint, `--r-sm`: scheduled (neutral), ready (cyan tint), live (red, with a pulsing dot), completed (green tint), cancelled/failed (muted).
- **Empty states.** One line of what this is, one primary action. Never a shrug illustration.
- **Toasts.** Bottom-right in console, bottom-center in call. Auto-dismiss 4s; errors persist until dismissed.
- **Motion.** 150ms ease-out for state changes; 200ms for panel slides. The only ambient motion in the product is the speaking ring and the live recording dot. Respect `prefers-reduced-motion` by replacing both with a static state.

### 9.6 Accessibility floor (MUST)

Visible keyboard focus everywhere (2px cyan ring, 2px offset). All controls reachable by keyboard. `aria-live="polite"` on the transcript stream. Contrast ≥ 4.5:1 for text on both surfaces — note that `--nuaig-cyan` on white fails for small text, so use `--nuaig-cyan-600` or darker for cyan text, and reserve pure cyan for fills and indicators.
---

## 10. Route map

```
PUBLIC (no auth)
  /join/[token]                 Magic link entry: consent → device check → lobby
  /join/[token]/room            The client's call view
  /join/invalid                 Expired / revoked / not-found
  /join/ended                   Post-call thank-you

AUTH
  /login                        Microsoft SSO only
  /auth/callback                OAuth return

CONSOLE (auth required)
  /                             Dashboard (role-aware)
  /interviews                   List — all (admin) or assigned (member)
  /interviews/new               Schedule (admin)
  /interviews/[id]              Detail: participants, link, transcript, recording
  /interviews/[id]/room         Live call — steward / observer view
  /clients                      Organisations (admin)
  /clients/[id]                 Detail: contacts, assessments, interview history
  /assessments/[id]             Engagement: departments covered, interviews, progress
  /templates                    List (admin)
  /templates/[id]               Editor (admin)
  /knowledge                    Domain docs + past assessments (admin)
  /team                         NuAIg members (admin)
  /settings                     Profile & preferences
  /audit                        Audit log (admin)
```

### 10.1 API routes

```
POST   /api/interviews/[id]/invitation      Issue magic link            admin
DELETE /api/interviews/[id]/invitation      Revoke                      admin
POST   /api/join/[token]/verify             Validate token, return interview summary   public
POST   /api/join/[token]/token              Mint publisher LiveKit token               public
POST   /api/interviews/[id]/token           Mint listen-only LiveKit token             member+
POST   /api/interviews/[id]/start           Transition to live, start worker           member+
POST   /api/interviews/[id]/end             Stop, finalize transcript                  member+
POST   /api/interviews/[id]/nudge           Queue a steward nudge                      steward
POST   /api/agent/turn                      Worker → next question (internal, signed)  worker
GET    /api/interviews/[id]/transcript      Export .txt / .docx / .json                scoped
GET    /api/interviews/[id]/recording       Signed Storage URL                         scoped
```

`/api/agent/turn` is called by the worker, not a browser. Protect it with a shared secret header, not a user session.

---

## 11. Page specifications

### 11.1 `/login`

Single centred card on `--bg`. NuAIg logo, one line ("Sign in to continue"), one button: **Sign in with Microsoft**. No email/password field, no signup link, no "forgot password". If SSO returns a user with no `profiles` row and no pending invite, show a clear rejection: this portal is for NuAIg staff.

### 11.2 `/` Dashboard

Role-aware, one screen, no scroll-hunting.

**Admin:** a "Live now" strip (only rendered when a call is active, with a join button), then Today's schedule, then Recent interviews, then four small counters (active clients, interviews this month, hours recorded, templates). 

**Member:** "Your next interview" as a prominent card with a join button that activates 10 minutes before the scheduled time, then your upcoming and recent assigned interviews. Nothing else.

### 11.3 `/interviews`

The workhorse table. Columns: Status pill · Client · Department · Interviewee · Scheduled · Duration · Participants (stacked avatars) · actions. Filters: status, client, date range, "mine only". Search by client or interviewee. Rows link to detail; a live row shows a **Join** button inline.

### 11.4 `/interviews/new` (admin)

Single-column form, grouped, no wizard: Client → Assessment → Contact (interviewee) → Department → Template → Date & time → Assign NuAIg team (multi-select with steward/observer toggle per person). On save, offer **Generate join link** immediately with a copy button.

### 11.5 `/interviews/[id]`

Header: title, client, status pill, scheduled time, and the primary action which changes by state — *Generate link* (scheduled) → *Join call* (ready/live) → *View transcript* (completed).

Tabs: **Overview** (participants, template, join-link panel with copy/reissue/revoke and expiry), **Transcript** (turn-by-turn, timestamped, steward layer toggleable for those who can see it, export buttons), **Recording** (player, download), **Activity** (audit trail for this interview).

The join-link panel shows the raw token **once** at generation. After that, only "issued, expires in N days" with reissue and revoke.

### 11.6 `/clients` and `/clients/[id]`

List: name, type, city/state, open assessments, last interview, status. Detail: contacts table (the interview pool), assessments with progress, full interview history, notes.

### 11.7 `/templates/[id]` (admin)

Two-pane editor. Left: ordered question list, drag to reorder, each with question text, intent (what this is really probing), required flag, max follow-ups, and probe hints. Right: live preview of how the agent will open and move through it, plus template config — time cap, inactivity timeout, department. Publish is explicit and creates a new version; published templates in use are immutable.

### 11.8 `/knowledge` (admin)

Two sections: **Domain knowledge** (LTPAC/CCRC process maps, glossaries, department notes) and **Past assessments** (the 15 prior reports, optionally scoped to an organisation). Upload, tag by department, show indexing status (queued → chunking → embedded → ready). Retry on failure.

### 11.9 `/team` (admin)

Members table: name, email, role, status, interviews assigned, last active. Invite by email (they still sign in with Microsoft SSO). Change role, deactivate. An admin cannot demote or deactivate themselves if they are the last active admin.

### 11.10 Client join flow — `/join/[token]`

This is the client's entire experience. It must be short, calm, and obviously legitimate.

**Step 1 — Welcome.** NuAIg logo. "You're joining an assessment interview with {Organisation}." Shows department, expected duration, and who the interview is for. If the token is invalid → `/join/invalid` with a plain explanation and a "contact NuAIg" line. If it is more than 15 minutes before the scheduled time → a waiting state that polls.

**Step 2 — Consent (MUST).** Plain-language notice in a bordered panel: this conversation is conducted by an AI interviewer, it is recorded and transcribed, and NuAIg team members may be listening live. An explicit **I understand, continue** button. **Decision needed:** final wording, reviewed for state recording-notice norms.

**Step 3 — Device check.** Microphone selector, a live input-level meter, and a short "say something" prompt so they can confirm they are being picked up. Clear permission-denied recovery with per-browser instructions. **Join interview** is the primary action and is the user gesture that starts audio (see §6.2).

**Step 4 — In call.** The client stage (§12).

**Step 5 — Ended.** `/join/ended`: thank-you, no further action, no way back in. The link is not reusable after the interview reaches `completed`.

---

## 12. The call interface

Modelled on Microsoft Teams: dark stage, rounded participant tiles, a floating centred control bar, and a right rail that slides in. Audio-only, so tiles are avatar-led rather than video-led.

### 12.1 Stage layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ● REC   Finance — Meadowbrook Senior Living          00:14:32   [⋯] │  top bar
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              ┌────────────────┐    ┌────────────────┐                │
│              │                │    │                │                │
│              │      ╭───╮     │    │     ╭───╮      │                │
│              │      │ N │     │    │     │MR │      │                │  stage
│              │      ╰───╯     │    │     ╰───╯      │                │
│              │   NuAIg Agent  │    │  Maria Reyes   │                │
│              │   ◦ speaking   │    │                │                │
│              └────────────────┘    └────────────────┘                │
│                                                                      │
│                                                                      │
│              ╭──────────────────────────────────────╮                │
│              │  🎤   👥 3   💬   ⋯            Leave  │                │  control bar
│              ╰──────────────────────────────────────╯                │
└──────────────────────────────────────────────────────────────────────┘
```

With the right rail open (steward view):

```
┌───────────────────────────────────────┬──────────────────────────────┐
│  ● REC   Finance — Meadowbrook  14:32 │  Transcript   Steer   People │
├───────────────────────────────────────┼──────────────────────────────┤
│                                       │  Agent   14:02               │
│      ┌──────────┐  ┌──────────┐       │  How do you currently handle │
│      │   ╭──╮   │  │   ╭──╮   │       │  month-end close?            │
│      │   │N │   │  │   │MR│   │       │                              │
│      │   ╰──╯   │  │   ╰──╯   │       │  Maria   14:09               │
│      │  Agent   │  │  Maria   │       │  We still do a lot of it in  │
│      └──────────┘  └──────────┘       │  spreadsheets, honestly…     │
│                                       │                              │
│                                       │  ▌ typing…                   │
│      ╭───────────────────────────╮    ├──────────────────────────────┤
│      │ 🎤  👥 3  💬  ⋯    Leave  │    │ Nudge the agent…        [↵]  │
│      ╰───────────────────────────╯    └──────────────────────────────┘
└───────────────────────────────────────┴──────────────────────────────┘
```

### 12.2 Participant tiles

- Rounded rectangle, `--r-lg`, `--stage-raised`, min 240×180, responsive grid, centred, max 4 across.
- Circular avatar with initials; the agent tile uses the NuAIg mark instead of initials.
- Name below, role badge for NuAIg participants ("Observing", "Steward").
- **Speaking indicator:** a 2px `--nuaig-cyan` ring that scales subtly with audio level. This is the single piece of ambient motion in the product and is what makes the call feel alive. Under `prefers-reduced-motion`, show a static cyan ring instead.
- **Muted listeners are not tiles.** Observers and stewards appear in the roster, not on stage — otherwise the stage fills with silent squares. Only the interviewee and the agent get tiles. This is a deliberate departure from Teams and keeps the client's screen calm.

### 12.3 Control bar

Floating, centred, `--r-lg`, `--stage-raised` with `--shadow-float`.

| Control | Client | Steward | Observer |
|---|:---:|:---:|:---:|
| Microphone toggle | ✅ | — (no publish rights) | — |
| People / roster | ✅ | ✅ | ✅ |
| Transcript panel | — | ✅ | ✅ |
| Steer panel | — | ✅ | — |
| Settings (device) | ✅ | ✅ | ✅ |
| Leave | ✅ | ✅ | ✅ |
| **End interview** | — | ✅ | — |

The client's bar has four controls. That is the whole point — their interface is nearly empty.

`End interview` is destructive-styled and confirms once ("This ends the call for everyone and saves the transcript").

### 12.4 Right rail

Width 360px, slides in over the stage on narrow screens, sits beside it above 1280px.

**Transcript tab.** Live entries, newest at the bottom, auto-scroll with a "jump to latest" pill when scrolled up. Speaker name, relative timestamp, text. Interim (non-final) text renders in `--stage-muted` italic and settles when finalized. Steward nudges appear inline as a distinct cyan-bordered note, visible only to NuAIg.

**Steer tab (steward only).** A text input and a queue. Typing a nudge shows it as **Queued** until the agent applies it at the next turn boundary, then **Applied** with a timestamp. This state feedback matters — without it the steward does not know whether their instruction landed and will over-type. Include 3–4 one-tap quick nudges: *Probe deeper*, *Move on*, *Ask for an example*, *Clarify that answer*.

**People tab.** Grouped: Interviewee, AI agent, NuAIg team (with steward/observer badges). Shows join times. The client sees this list in full — observers are never hidden.

### 12.5 Live states

- **Recording dot.** Red, gently pulsing, with "REC" text, top-left, whole call. Never subtle.
- **Agent thinking.** Between the interviewee finishing and the agent speaking, the agent tile shows three animated dots. Silence without feedback reads as a broken call.
- **Connection quality.** Icon in the top bar; on degradation show a toast ("Reconnecting…") and on drop, an overlay with a rejoin action.
- **Time cap warning.** At T-5 minutes, a quiet toast to NuAIg participants only. The client is not shown a countdown — it changes how people answer.

### 12.6 Responsive

Console is desktop-first (1280+) and usable to 1024. The **client join flow MUST work on mobile** — staff will open the link on a phone. At mobile width the stage becomes a single centred tile, the control bar spans the bottom edge, and the right rail is a full-screen sheet. Test on a physical iPhone (§6.2).
---

## 13. Stopping criteria

Every call **MUST** end deterministically. Six paths, one teardown.

| # | Path | Behaviour | Owned by |
|---|---|---|---|
| 1 | **Natural completion** | Template fully covered; agent delivers a closing and ends. Primary path. | Agent logic |
| 2 | **Hard time cap** | Max duration from template config (default 45 min). At T-5 the agent begins compressing; at T-0 it moves to a closing question and ends. Never a mid-sentence cut. | Server timer |
| 3 | **Turn / follow-up budget** | `max_followups` per question stops the agent looping on one topic. | Agent logic |
| 4 | **Steward stop** | A steward ends the call instantly from the control bar. The key safety valve. | Steward panel |
| 5 | **Interviewee exit / disconnect** | Agent recognises explicit exit intent ("I have to go") and closes gracefully. Server handles tab-close and dropped connections via LiveKit disconnect events plus a grace period for rejoin. | Agent + server |
| 6 | **Inactivity** | No speech for N seconds (default 90) → agent prompts once → ends if still silent. | Server timer |

### 13.1 Unified teardown (MUST)

However a session ends, it performs the same sequence:

1. Speak a graceful close, where the path allows it.
2. Flush any pending transcript entries and mark them final.
3. Write `ended_at`, `duration_seconds`, and `end_reason`.
4. Finalize and store the recording.
5. Set status to `completed` (or `failed`).
6. Disconnect the worker and close the room.
7. Invalidate the magic link for rejoin.

Because the transcript is the entire deliverable, implement teardown **once** as a single function that all six paths call. Do not duplicate this logic per path.

---

## 14. Phased build plan

Eight phases. Each leaves something demoable. Difficulty is build/deploy on 1–10 for a happy-path internal tool.

---

### Phase 0 — Foundation, branding, auth, database

**Goal.** A branded, deployed Next.js app on Vercel where a NuAIg member signs in with Microsoft and reaches an authenticated shell, with the full schema live on Supabase.

**Scope**
- Next.js (App Router, TypeScript) + Tailwind. Single repo. Deploy to Vercel on push.
- Supabase project: run the §7 DDL including `vector`, seed enums, enable RLS with §8.1 policies.
- Microsoft SSO via Supabase Auth Azure provider. `profiles` row created on first login; first user is `admin`.
- Design tokens from §9.3 as CSS variables; Inter via `next/font`; logos in `/public/brand/`.
- App shell: sidebar nav (role-filtered), top bar with user menu, breadcrumbs, toast host.
- Component primitives: Button, Card, Table, StatusPill, Dialog, Input, Select, Tabs, EmptyState, Toast.
- `/login`, `/`, `/settings` real; other console routes stubbed with EmptyState.
- Health-check route; env schema validated at boot (fail fast on missing keys).

**Exit criteria.** Deployed on Vercel. A NuAIg user signs in with Microsoft, lands on a branded dashboard, and their `profiles` row exists with the right role. A signed-out user hitting a console route is redirected. RLS verified: a `member` cannot read another member's interview rows.

**Difficulty.** 3 / 3

**Notes.** Azure app registration needs IT/admin consent — start it on day one, it is the only external dependency that can block. Get the schema right here; Phases 4–7 assume it.

---

### Phase 1 — Admin console: clients, team, scheduling, magic links

**Goal.** An admin can set up a client, schedule an interview, assign team members, and produce a working join link. No call yet.

**Scope**
- `/clients`, `/clients/[id]` with contacts CRUD.
- `/assessments/[id]`.
- `/team`: invite, role change, deactivate, last-admin guard.
- `/interviews`, `/interviews/new`, `/interviews/[id]` (Overview tab).
- Magic link issue/reissue/revoke per §7.4 — 32-byte token, sha256 at rest, shown once, expiry, rate-limited verify route.
- `/join/[token]` steps 1–2 (welcome + consent), and `/join/invalid`. No media yet.
- Audit log writes for link issue/revoke and role changes; `/audit` page.
- Member dashboard showing assigned interviews only.

**Exit criteria.** Admin creates client → contact → assessment → interview → assigns two members → generates a link. Opening the link in a private window shows the correct welcome and consent for that interview. A revoked or expired link shows `/join/invalid`. A member signed in sees only their assigned interviews.

**Difficulty.** 4 / 2

**Notes.** This phase is pure CRUD and is where the role model gets proven. Build it before any media work so the call has real records to attach to.

---

### Phase 2 — Live call: LiveKit room, Teams-style UI, listen-only observers

**Goal.** A real audio call. The client joins by magic link and talks; NuAIg members join and hear them live and cannot be heard.

**Scope**
- LiveKit Cloud project. Server routes minting **scoped** tokens: publisher for the interviewee, `canPublish: false` for steward/observer.
- `/join/[token]` steps 3–4: device check with live input meter, then the client stage.
- `/interviews/[id]/room`: the NuAIg call view with roster and listen-only audio.
- Full call UI per §12: stage, tiles, speaking ring, floating control bar, right rail shell with People tab, recording indicator, connection states.
- Interview lifecycle: `ready` → `live` → `completed`; participant join/leave times recorded.
- Leave and End interview (partial teardown — no transcript yet).
- Audio-only throughout. Mobile client flow working.

**Exit criteria.** A client on a phone opens the link, passes the mic check, joins, and speaks. Two NuAIg members join from the console and hear them in real time. Neither can transmit audio even with devtools open — server-side token rights enforce it. The roster is accurate on both sides. Leaving ends cleanly and records timings.

**Difficulty.** 6 / 3

**Notes.** The media de-risking phase. TURN is inside LiveKit Cloud — nothing to run. Test from a restrictive network, not just the office. Verify iOS audio starts inside the Join tap.

---

### Phase 3 — Voice bridge: the agent gets a voice

**Goal.** The agent worker joins the room, bridges audio to ElevenLabs, and speaks in a human-like voice. Logic still dumb.

**Scope**
- Standalone Node worker on Railway/Render/Fly (§6.1), deployed independently of Vercel.
- Worker joins the room on `interview.start`, subscribes **only** to the interviewee's track (pinned identity), streams to ElevenLabs STT, publishes TTS back as the agent track.
- Agent tile on stage with speaking ring and thinking state.
- `transcript_entries` written with `seq` and offsets; live broadcast over Supabase Realtime.
- Transcript tab in the right rail rendering live, with interim vs final states.
- Fixed scripted replies only — no LLM yet.
- Worker lifecycle: start, health, reconnect, clean shutdown; `failed` status on crash.

**Exit criteria.** Client speaks a fixed script; agent replies in the ElevenLabs voice with low latency and no talking over. Observers hear **both** the client's real voice and the agent's voice. The live transcript appears in the rail for NuAIg and is persisted. Observer speech never appears in the transcript.

**Difficulty.** 6 / 4

**Notes.** Build a throwaway bridge spike first — the ElevenLabs⇄LiveKit turn-detection integration has known configurable rough edges, and finding them here is far cheaper than in Phase 4. Keep replies hard-coded so you are tuning the pipeline, not the brain.

---

### Phase 4 — Adaptive agent on a template

**Goal.** Claude conducts a full templated interview start to finish and produces an exportable transcript.

**Scope**
- `/templates` and `/templates/[id]` editor with versioning and publish.
- Prompt assembly: template state + running transcript + config.
- `/api/agent/turn` (shared-secret protected): worker → next question.
- Turn orchestration until the template completes; graceful intro and closing.
- Stopping criteria 1 and 3 (natural completion, follow-up budget) + the unified teardown from §13.1.
- Transcript export: clean `.txt`/`.docx` and full `.json`.
- Transcript tab on `/interviews/[id]` for completed interviews.

**Exit criteria.** An admin publishes a template, schedules an interview against it, and the agent runs the whole thing unaided — intro, all questions, light follow-ups, closing — then ends itself and saves an exportable transcript. Teardown produces identical state whether it completes naturally or hits the follow-up budget.

**Difficulty.** 5 / 3

**Notes.** Keep follow-ups light. Depth is a tuning layer in Phases 5 and 7 — do not block this phase on interview quality.

---

### Phase 5 — Domain knowledge base

**Goal.** The agent sounds like it knows senior living.

**Scope**
- `/knowledge` admin page: upload, tag by department, indexing status.
- `knowledge_documents` ingestion for `kind = 'domain'`; chunk and store (embeddings wired here, retrieval used in Phase 7).
- Curated domain context injected into the prompt for the relevant department.
- Prompt tuning for correct terminology and context-aware follow-ups.
- Pronunciation handling for facility jargon and acronyms.

**Exit criteria.** Side-by-side with Phase 4, the same template produces noticeably more domain-specific questions and correct terminology. Uploaded documents reach `ready` status and failures can be retried.

**Difficulty.** 4 / 2

**Notes.** Static curated context first, retrieval later — faster to iterate and usually enough to be convincing.

---

### Phase 6 — Steward steering, observer panel, recordings

**Goal.** A NuAIg steward silently redirects the agent mid-interview, and every call leaves a recording.

**Scope**
- Steer tab (§12.4): input, queue, **Queued → Applied** state feedback, quick-nudge buttons.
- `/api/interviews/[id]/nudge`; nudges applied at the next turn boundary, never mid-utterance; human nudge outranks the scripted branch.
- `steward_notes` persisted; inline in the NuAIg transcript view; excluded from client-facing exports and toggleable in the full export.
- Observer view = steward view minus the Steer tab.
- Stopping criterion 4 (steward stop) wired to the unified teardown.
- Recording: capture the room, store in a private Supabase Storage bucket, `recordings` row, player and signed-URL download on `/interviews/[id]`, scoped by §8.

**Exit criteria.** Mid-call, a steward types "push harder on incident reporting" and the agent's next question visibly changes. The interviewee sees and hears nothing of it. An observer watching the same call sees the transcript but has no Steer tab. Ending from the control bar tears down cleanly. The recording plays back afterwards for authorised users only.

**Difficulty.** 7 / 3

**Notes.** The hardest phase: real-time, async, and stateful. The Queued/Applied feedback is not polish — without it stewards over-type and fight the agent. Retain the steward layer even when excluded from exports; it is the best signal for template tuning in Phase 7.

---

### Phase 7 — Past-assessment RAG, full stopping criteria, vertical demo

**Goal.** The agent is grounded in NuAIg's own prior assessments, every stop path is covered, and one vertical is demo-ready.

**Scope**
- Ingest the 15 prior assessment reports (`kind = 'past_assessment'`); chunk, embed, index with pgvector.
- Retrieval in the turn loop: pull relevant prior findings to sharpen probing; cap injected context so latency stays flat.
- Remaining stopping criteria 2, 5, 6 (time cap with graceful compression, exit intent and disconnect with rejoin grace, inactivity) — all through the single teardown.
- Production-quality template + knowledge slice for one chosen vertical.
- Tuning round using the Phase 6 steward layer to find where the agent fell short.

**Exit criteria.** A full demo on one senior-living vertical: an informed, adaptive interview that references patterns from prior assessments, is observable and steerable by the team, ends correctly under every one of the six paths (test each deliberately), and produces a clean transcript and recording every time.

**Difficulty.** 6 / 3

**Notes.** This is the first genuinely *real* product; Phases 0–6 are runway. Test each stop path on purpose — including pulling the client's network mid-call.

---

### 14.1 Difficulty summary

| Phase | Focus | Build | Deploy |
|:---:|---|:---:|:---:|
| 0 | Foundation, branding, SSO, schema | 3 | 3 |
| 1 | Admin console, scheduling, magic links | 4 | 2 |
| 2 | LiveKit room, Teams-style call UI, observers | 6 | 3 |
| 3 | ElevenLabs voice bridge (worker) | 6 | 4 |
| 4 | Adaptive agent on a template | 5 | 3 |
| 5 | Domain knowledge base | 4 | 2 |
| 6 | Steward steering, observers, recordings | 7 | 3 |
| 7 | RAG, full stop criteria, vertical demo | 6 | 3 |

The two real hotspots are **Phase 3** (voice-loop turn-taking) and **Phase 6** (real-time steering). Everything else is well-trodden. Interview *quality* is a tuning effort across Phases 4–7, not a build blocker.

---

## 15. Environment

```bash
# App
NEXT_PUBLIC_APP_URL=
AGENT_WORKER_SECRET=              # shared secret for /api/agent/turn

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, never bundled

# Microsoft SSO (configured in Supabase Auth → Azure)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# LiveKit
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# ElevenLabs (worker + server)
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_AGENT_ID=

# Anthropic
ANTHROPIC_API_KEY=

# Behaviour defaults
INTERVIEW_TIME_CAP_MINUTES=45
INTERVIEW_INACTIVITY_SECONDS=90
INVITATION_EXPIRY_DAYS=7
```

Validate all of these at boot with a schema (zod) and fail fast. A missing LiveKit secret should break the build, not the call.

---

## 16. Paid services

Indicative 2026 rates gathered during scoping; **confirm on each vendor's pricing page at build time.** Volume assumed: internal assessment calls, not high-volume production.

| Service | Model | Note for NuAIg's volume |
|---|---|---|
| **ElevenLabs** | ~$0.08/min agent minutes, or per-component on Speech Engine. LLM billed separately. | A low paid tier plus overage covers a pilot. Confirm which meter the Speech-Engine-with-LiveKit path uses. |
| **LiveKit Cloud** | ~$0.01/agent-session min + ~$0.0004–0.0005/participant-min. Free Build tier: 5,000 WebRTC + 1,000 agent min/mo. | **Every participant is metered, including each listen-only observer.** Free tier may cover the pilot. |
| **Anthropic Claude** | Per-token, passthrough. | Moderate per call; voice minutes dominate. |
| **Supabase** | Free tier, then ~$25/mo Pro. | Pro likely needed for recording storage and backups. |
| **Vercel** | Free tier, then ~$20/seat Pro. | |
| **Worker host** | ~$5–20/mo (Railway/Render/Fly). | Small persistent instance. |
| **Microsoft Entra ID** | Included in M365/Azure. | Likely $0 incremental. |

**Main cost lever:** live team audio adds LiveKit plus per-observer participant minutes. Cheap at this volume, but observer count scales it. Keep observer lists intentional.

---

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Turn-taking feels robotic | Undermines R1 | Spike the bridge in Phase 3 before committing; budget tuning time |
| Worker crash mid-interview | Lost transcript | Health checks, auto-restart, partial transcript flushed continuously — never buffered to the end |
| iOS Safari audio | Client can't join from phone | Audio starts in the Join tap; test on device in Phase 2 |
| Restrictive facility network | Call fails on site | LiveKit TURN handles it; test from a locked-down network in Phase 2 |
| Magic link leaked/forwarded | Unauthorised join | Short expiry, revoke, rate limiting, single active interview per link, audit log |
| Over-steering | Steward puppeteers the agent | Queued/Applied feedback, quick nudges, review nudge density during tuning |
| Agent accepts non-answers | Weak transcripts | Follow-up budget with intent checks in the prompt; steward as backstop |

---

## 18. Decisions needed from NuAIg

1. **Consent wording** for the client join screen, reviewed against state recording-notice norms.
2. **Retention policy**: how long transcripts and recordings are kept, and who may download them.
3. **Magic link expiry window** (default proposed: 7 days after scheduled time).
4. **Interview time cap** (default proposed: 45 minutes).
5. **Which department/template** Phase 4 targets first.
6. **Which vertical** Phase 7 demos.
7. **ElevenLabs voice** selection, and whether a custom NuAIg brand voice is wanted.
8. Whether the client should receive the link **by email from the portal** or copied and sent by the consultant. (Spec currently assumes copy-and-send; email delivery adds a mail provider.)

---

*NuAIg LLC — internal technical specification v1.0. Architecture: LiveKit-fronted for live team audio. Interview deliverable is the transcript; no analysis in scope. Built by Claude Code, deployed by NuAIg on Vercel + Supabase + one always-on worker host.*
