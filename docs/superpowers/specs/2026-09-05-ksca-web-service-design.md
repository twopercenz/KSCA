# KSCA Web Service — Implementation Design

Date: 2026-09-05
Status: Approved for planning

## Relationship to README.md

`README.md` (v1.0) is the authoritative functional/DB/security spec: user
roles, the paper archive (Zenodo-style concept_id + versioning), the
community board, the report-based moderation model, the full Postgres
schema, RLS policies, and the `generate_concept_id()` / report-threshold
trigger functions. This document does **not** restate or re-decide any of
that — it covers *how* this codebase implements that spec: project
structure, build order, the two flows the README leaves at the "route
example" level (signed uploads, admin review), testing approach, and what
gets added to README.md as contributor-facing guidelines.

Where this document is silent, README.md governs.

## Decisions from brainstorming

- **Full build, phased**, in one continuous session — not a UI-only
  prototype, not a single vertical slice.
- **Supabase via local CLI** (`supabase start`) for this build. The app
  reads config from env vars so a real project can be swapped in later
  without code changes.
- **Tailwind + shadcn/ui** for components.
- **Visual direction**: proposed by the assistant during the UI-building
  phase (clean academic-archive feel with a youth-community warmth —
  finalized in code/CSS, not re-litigated here).
- **Seed data**: `supabase/seed.sql` with sample papers (incl. one
  multi-version paper), board posts across categories, comments, and one
  seeded admin profile, so every page is browsable immediately after
  setup.
- **README.md gets appended sections** (existing spec content is not
  rewritten): Local Dev Setup, Project Structure & Conventions,
  Contribution Workflow, Deployment Guide.

## Architecture

Single Next.js (App Router) project, TypeScript, deployed to Vercel,
backed by Supabase (Postgres + Auth + Storage). No monorepo, no separate
Edge Functions service — Next.js Server Actions and Route Handlers cover
everything the README's "server" side needs (signed URL issuance, report
submission, admin review actions), keeping one language and one deploy
target for v1.0. This trades away independent scaling of upload logic for
simplicity; revisit only if a real scaling need appears.

## Project structure

```
/app
  /(marketing)/page.tsx                    — landing: intro + latest papers
  /papers/page.tsx                         — archive list (filter/sort)
  /papers/[concept_id]/page.tsx            — latest version detail
  /papers/[concept_id]/v/[n]/page.tsx      — specific version
  /papers/upload/page.tsx                  — new paper (auth required)
  /papers/[concept_id]/upload-version/page.tsx — new version (author only)
  /board/page.tsx                          — category list
  /board/[category]/page.tsx               — posts in category
  /board/post/[id]/page.tsx                — post detail + comments
  /board/write/page.tsx                    — new post (auth required)
  /login/page.tsx, /signup/page.tsx
  /me/page.tsx                             — my papers / posts / reports
  /admin/page.tsx                          — admin home (role-gated)
  /admin/reports/page.tsx                  — report review queue
  /api/papers/[id]/download/route.ts       — mints signed URL, redirects

/lib
  /supabase/client.ts                      — browser client
  /supabase/server.ts                      — SSR/server-action client (cookies)
  /actions/papers.ts                       — upload, new-version, report
  /actions/board.ts                        — create post/comment, report
  /actions/admin.ts                        — resolve report (hide-confirm / restore)
  /citation.ts                             — APA/BibTeX formatting from paper row

/components
  /ui/*                                    — shadcn primitives
  PaperCard.tsx, VersionBadge.tsx, ReportButton.tsx, CitationBlock.tsx,
  CommentThread.tsx, RoleGate.tsx, ...

/supabase
  /migrations/*.sql                        — schema + RLS + functions (README §8-12, verbatim)
  seed.sql
```

## Build order

1. **Scaffold** — `create-next-app`, Tailwind, shadcn init, base layout/nav/footer,
   Supabase CLI init, migrations written from README §8–§12, `supabase start`,
   `seed.sql` applied, env var wiring (`.env.local.example`).
2. **Auth** — Supabase Auth (email+password, email confirmation required per
   README §2), a DB trigger or post-signup action to create the matching
   `profiles` row, login/signup pages, `/me`.
3. **Paper archive** — upload flow (signed upload URL via Server Action →
   direct client upload), list/detail/version pages, APA/BibTeX generation
   and copy, `paper_comments` with "written at v_N" badges aggregated across
   a concept_id's versions, report button wired to `reports`.
4. **Community board** — categories incl. admin-only `notice`, post
   list/detail, single-level comments, same report flow reused.
5. **Admin** — `role === 'admin'` gate on `/admin` (server-side check, not
   middleware, per README §5.2), `/admin/reports` queue reading `pending`
   reports, 확정(keep hidden, mark reviewed) / 복구(restore to public, mark
   reviewed) actions.
6. **Polish** — verify the 3-report auto-hide trigger end-to-end for all
   four target types, empty/error/loading states, responsive pass, a11y
   pass on forms and the PDF viewer/download flow.
7. **README guidelines** — append Local Dev Setup, Project Structure &
   Conventions, Contribution Workflow, Deployment Guide sections.

## Key flows (implementation detail beyond README's route sketch)

**Signed upload**: client → Server Action (`actions/papers.ts`) validates
session + file constraints (PDF, ≤20MB) → `createSignedUploadUrl` on the
private `papers` bucket → returns URL+path to client → client PUTs the
file directly to Storage → on success, client calls a second Server Action
that inserts the `papers` row (`file_path` = bucket path only) and, for a
first version, calls `generate_concept_id()`; for a new version of an
existing concept_id, reuses it and increments `version_no`.

**Signed download**: `GET /api/papers/[id]/download` looks up `file_path`
for the requested paper row (respecting the same visibility rules as the
`papers_select` RLS policy — hidden papers only reach author/admin),
mints a short-lived `createSignedUrl`, and 302-redirects to it. No signed
URL is ever persisted.

**Report threshold**: pure DB-side (trigger from README §10) — the app
only inserts into `reports`; it never flips `status` itself except through
the admin resolve action, which is the sole place that can move `pending →
reviewed` (enforced by the `reports_update_admin_only` RLS policy, not
just UI hiding).

## Testing approach

- **DB-layer** (security-critical): scripted verification against the
  local Supabase instance — `generate_concept_id()` concurrency/format,
  the report-threshold trigger firing at exactly 3 pending reports for
  each of the four target types, and RLS policies (author/admin/anonymous
  read paths for hidden vs public rows) exercised as different roles.
- **App-layer**: component tests for non-trivial UI (citation formatting,
  version badge aggregation, role-gated rendering) and integration tests
  for the two Server Action flows above. TDD for all of this — tests
  before implementation.
- **Manual**: a final click-through of every route in the README §5
  routing table before calling the build done.

## Out of scope for this build (per README §14)

Real DOI/DataCite registration, board category expansion beyond the four
listed, and any decision on how much report history `/me` exposes — the
schema supports all of these later without migration changes.
