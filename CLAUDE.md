# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Current state

**`spec.md` is the source of truth**, except for the auth deviation described under "Staff auth" below. Read §4–§6 (architecture, services, hard constraints) before writing code. §14 is the work queue: eight phases (0–7), each with scope and exit criteria, built in order. Phases 0 (foundation, SSO, schema, shell) and 1 (clients, team, scheduling, magic links, join welcome/consent, audit log) are built. Later-phase routes (`/interviews/[id]/room`, `/templates`, `/knowledge`, and the join flow's device-check step) are placeholders.

Spec conventions: **MUST** means a hard requirement. **Decision needed** (§18) is blocked on NuAIg: don't guess. Ask, or leave a clearly marked placeholder.

## Commands

Next.js 16 (App Router) + React 19 + Tailwind v4, pnpm. Supabase is the **hosted** project only: there's no local Supabase or Docker. The `db:*` scripts (`scripts/`) call the Supabase Management API using `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` from `.env.local`.

```bash
pnpm dev                                 # needs .env.local (copy .env.example); env validated on start
pnpm build                               # fails fast on missing/invalid env (src/lib/env/schema.ts)
pnpm lint                                # ESLint incl. React Compiler rules (e.g. no Date.now() in components)
pnpm typecheck                           # next typegen && tsc --noEmit; runs without an .env
pnpm db:migrate [--dry-run]              # dry-runs all pending migrations in a rolled-back txn, then applies them
pnpm db:test [file]                      # pgTAP tests against the hosted db, always rolled back
pnpm db:types                            # regenerates src/lib/supabase/database.types.ts from the hosted schema
pnpm db:add-user <email> [admin|member]  # grants staff access (bootstrap until /team exists)
pnpm db:setup                            # idempotent: imports SUPABASE_JWT_SIGNING_KEY, locks down Supabase Auth
```

There is no JS test runner yet. To run a single pgTAP file: `pnpm db:test supabase/tests/database/rls.test.sql`.

The Management API tracks migrations by file name, so don't use `supabase db push` (it would try to re-apply them). Never edit an applied migration; add a new file, then run `db:migrate`, `db:test` and `db:types`.

## What this is

This is an internal NuAIg tool that automates assessment interviews. A client staff member opens a magic link with no login, then talks to an AI voice agent. NuAIg team members listen live. A steward silently steers the agent with text. **The deliverable is the transcript (plus a recording).** Analysis, scoring, summaries, reports, video, telephony, PHI handling, and multi-tenancy are all out of scope.

## Architecture (spans multiple services)

```
Vercel (Next.js)      UI, API routes, staff sign-in (Microsoft OIDC), agent brain (Claude), stopping criteria
Always-on worker      Node process: LiveKit room <-> ElevenLabs WebSocket (STT/TTS/turn detection)
LiveKit Cloud         The room: all call audio flows through it, which is what lets observers listen
Supabase              Postgres + pgvector (RLS), Storage (recordings), Realtime (live transcript). Supabase Auth is NOT used.
Microsoft Entra ID    Identity only (name, email, object id) for NuAIg staff
```

Key design points that are easy to get wrong:

- **The agent worker cannot run on Vercel.** It holds persistent LiveKit and ElevenLabs connections for the whole call, so it deploys separately (Railway/Render/Fly). It calls back into the app through `POST /api/agent/turn`, which is protected by a shared-secret header (`AGENT_WORKER_SECRET`), not a user session.
- **Two-track audio.** Track 1 is the interviewee's real mic and is never voice-converted. Track 2 is the ElevenLabs agent voice. The worker subscribes **only** to the interviewee's track, pinned by identity. That keeps observers out of the transcript and gives speaker attribution for free, so don't add diarization.
- **Turn loop:** interviewee audio → worker → ElevenLabs STT → transcript row written + broadcast over Supabase Realtime → app builds the prompt (template state + domain knowledge + RAG from past assessments + pending steward nudge) → Claude → text → ElevenLabs TTS → Track 2.
- **Steward nudges** are applied at the next turn boundary, never mid-utterance. They move from Queued to Applied (`steward_notes.applied_at`), and that UI feedback is required. Nudges live in their own table so they can be excluded from client-facing exports.
- **Stopping criteria (§13):** six end paths (natural completion, time cap, follow-up budget, steward stop, interviewee exit/disconnect, inactivity). All of them MUST call **one** unified teardown function. Flush the transcript continuously during the call rather than buffering it to the end.
- **No custom WebSocket server.** Supabase Realtime handles live fan-out. Add services only when a requirement demands it (R11).

## Staff auth (deliberate deviation from spec §5/§7)

The spec had Supabase Auth's Azure provider with `profiles` mirroring `auth.users`. NuAIg asked for the app to own sign-in instead:

1. `/login` server action (`src/lib/auth/oidc.ts`) sends the user to Microsoft (single-tenant, `openid profile email`, PKCE). State, nonce and verifier go in a signed short-lived `nuaig_oidc` cookie.
2. Microsoft redirects to **`${NEXT_PUBLIC_APP_URL}/auth/callback`** (the Vercel URL, registered in Azure). The callback validates the ID token and takes only `oid`, `email` (falling back to UPN) and `name`.
3. `admitUser()` (`src/lib/auth/admit.ts`, service role) checks the **`users` table**, the allow-list and role source. It matches on `microsoft_oid` once bound, otherwise on email (binding `oid` on that first sign-in). It refuses unknown, deactivated, or already-bound-to-another-account users.
4. It sets `nuaig_session`: a 12h HS256 JWT (`SESSION_SECRET`) naming `users.id`.
5. Per request, `createUserClient(userId)` signs a 5-minute **Supabase access token** (ES256, `SUPABASE_JWT_SIGNING_KEY`, a key imported into the Supabase project) with `sub = users.id` and `role = authenticated`. RLS therefore works unchanged: `auth.uid()` is `users.id`. Import the JWK with only `kty/crv/x/y/d`: the CLI's `key_ops` includes `verify`, which WebCrypto rejects on a private key.

Implications:
- **Admins grant access by inserting a `users` row** (email lower-cased, role). There's no "first user becomes admin"; bootstrap one with `pnpm db:add-user <email> admin`.
- Name and email come from Microsoft, so there's no self-service profile editing. SSO only works on `NEXT_PUBLIC_APP_URL`, because preview deployments need their own Azure redirect URI and env.
- Never trust a user id from request input. Only `requireUser()`/`requireAdmin()` produce ids you may pass to `createUserClient`.

## Code conventions that span files

- **Env:** every variable is declared in `src/lib/env/schema.ts`. Read it through `env` (`src/lib/env/server.ts`, server-only); `src/proxy.ts` is the one exception and parses only `SESSION_SECRET` itself. Keys for later-phase services are `.optional()` until their phase lands, and then must become required.
- **Guards:** `src/proxy.ts` (Next 16's renamed middleware) only checks the session cookie signature. Call `requireUser()` or `requireAdmin()` (`src/lib/auth/session.ts`) in **every** console page and server action, not just the layout; they re-read the `users` row so deactivation is immediate. `requireAdmin` uses `forbidden()` (`experimental.authInterrupts`). New public routes must be added to `PUBLIC_PATHS` in the proxy. Never `<Link>` to `/auth/signout`, because prefetching signs the user out.
- **Supabase clients:** `createUserClient(user.id)` (`lib/supabase/server.ts`, RLS applies) is the default. `createAdminClient()` (`admin.ts`) is the service role and bypasses RLS: use it only for sessionless work (sign-in, magic links, worker, health) and scope queries by hand. `must()`/`mustCount()` unwrap query results and throw on error.
- **RLS:** `supabase/migrations/*_rls_and_auth.sql` holds the SECURITY DEFINER helpers `is_admin()`, `is_active_staff()`, `is_assigned(interview_id)` and `is_steward(interview_id)`; use them in new policies instead of subqueries on `users` (they avoid recursion). `anon` has no table grants. Deactivated users match no policy. A trigger blocks demoting, deactivating or deleting the last active admin. Add a pgTAP case for every new policy. Tests fake the app token with `set local request.jwt.claims`. They run against the hosted project, so use fixed fixture ids and `@nuaig.test` emails, and don't assume tables are empty. `db:test` only captures `select` statements that start at column 0.
- **Multi-step writes** go in SECURITY INVOKER SQL functions (`create_interview`, `set_interview_team`, `issue_invitation`, `revoke_invitation`) called via `db.rpc`. They run in one transaction and RLS still applies to the caller. Raise user-facing errors with `errcode 22023` (invalid) or `P0002` (not found); `databaseErrorMessage()` passes those messages through and maps the rest.
- **Audit log** entries are written by triggers (`audit_event()` + `audit_*` triggers in the Phase 1 migration), with `auth.uid()` as the actor. Don't insert audit rows from app code for table changes; add a trigger. App-only events (transcript export, recording download, Phase 4+) need a callable logging function. Labels and detail text live in `src/lib/audit.ts`.
- **Forms:** server actions return `ActionState` (`src/lib/actions.ts`) and take `(boundArgs…, _state: unknown, formData)` so they can be `.bind`-ed with ids. Use `FormDialog` + `TextField`/`SelectField`/`TextareaField` (`src/components/forms`), which read field errors from context by `name`, and `ConfirmAction` for confirmed one-click actions. Validate bound ids with `isUuid` because bound args are client-controlled.
- **Magic links** (`src/lib/join`): `issueJoinLink` returns the raw URL once and stores only the hash. `resolveJoinToken` (service role) rate-limits by IP via `consume_rate_limit`, then checks revoked/expired/status. `/join/*` responses send `Referrer-Policy: no-referrer` (`next.config.ts`). Record pages can name their breadcrumb with `<BreadcrumbLabel segment={id} label={name} />`.
- **DB types:** `database.types.ts` is generated by `pnpm db:types`. Never hand-edit it, and regenerate after every migration. App code imports aliases (`AppUser`, `UserRole`, `InterviewStatus`, …) from `src/lib/supabase/types.ts`.
- **Design tokens** live in `src/app/globals.css` as spec §9.3 CSS variables mapped to Tailwind names (`bg-surface`, `text-fg-muted`, `bg-brand-700`, `rounded-md`, `shadow-panel`). Several darker shades were *added* because spec colors fail 4.5:1 for text: `--nuaig-cyan-700/800` for primary buttons and cyan text, and `--live-600`, `--ok-700`, `--warn-700` for status text. Pure `--nuaig-cyan` is for indicators only, and `--text-subtle` is never used for text.
- **Time:** server components don't format dates (the server timezone would be wrong). Use `<LocalTime>` and `useNow()`, which render in the viewer's timezone after hydration.
- `cn()` only joins classes and doesn't resolve Tailwind conflicts, so don't pass classes that fight a component's defaults.

## Security and permissions (MUST)

- LiveKit, ElevenLabs, Anthropic, Supabase service-role, Supabase JWT signing key and session secrets stay server-side. Browsers get short-lived, scoped tokens minted by API routes (LiveKit; and from Phase 3, Supabase tokens for Realtime via `signSupabaseAccessToken`).
- Listen-only is enforced **in the token** (`canPublish: false` for steward/observer), not by hiding UI.
- Magic links: 32 random bytes, base64url. Store only `sha256(token)` in `invitations.token_hash` and show the raw token once. A link is reusable until it expires or is revoked, but not after the interview is `completed`. Rate-limit the join routes by IP.
- Roles: `admin` sees everything. `member` sees only interviews they're assigned to through `interview_participants`. Clients are never database principals; their access goes entirely through server-side token validation. Enforce permissions with **both** RLS (the floor) and app guards.
- Transparency: the client must always see that the call is recorded and who is listening. Observers are never hidden from the roster.
- Write audit log entries for link issue/revoke, transcript export, recording download, role change, and interview deletion.

## Data model

The full DDL is in `supabase/migrations` (spec §7, with `profiles` replaced by `users` and `profile_id` columns renamed `user_id`). Transcript lines are `transcript_entries` rows ordered by `(interview_id, seq)`, with `started_at_ms` as the offset from interview start. Templates are versioned JSONB question lists, and published templates that are in use are immutable. Embeddings are `vector(1536)`.

## UI

- Two surfaces. The **console** (admin/team) is light and dense. The **call stage** is dark and modeled on Microsoft Teams.
- Only the interviewee and the agent get stage tiles. Stewards and observers appear in the roster only.
- Logos are in `/public/brand/`: `nuaig-logo-white.svg` on dark surfaces, `nuaig-logo.svg` elsewhere.
- The client join flow must work on mobile. On iOS Safari, start audio inside the Join button tap.
