# KSCA Web Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full KSCA web service (paper archive + community board + admin moderation) as a Next.js App Router app on Supabase, matching README.md's functional/DB/RLS spec.

**Architecture:** Single Next.js project (TypeScript, App Router), Supabase (Postgres + Auth + Storage) run locally via the Supabase CLI, Tailwind + shadcn/ui for components, Server Actions/Route Handlers for all server-side logic (no separate Edge Functions service).

**Tech Stack:** Next.js (latest stable, App Router), TypeScript, Tailwind CSS, shadcn/ui, @supabase/supabase-js, @supabase/ssr, Vitest for unit tests, Supabase CLI for local Postgres/Auth/Storage.

**Spec:** `README.md` (functional/DB/RLS spec of record) and `docs/superpowers/specs/2026-09-05-ksca-web-service-design.md` (this plan's design doc — file structure, build order, flow details).

## Deviation from README (documented, not silent)

README §3.1 lists an upload field for author name(s) ("저자명(본인 + 공동저자 텍스트 입력)"), but the "최종본" (final) schema in §8 has no column for it — only `author_id` (the uploader). Rather than silently dropping the described field or silently contradicting the "final" schema, this plan adds one additive migration: `alter table papers add column authors text not null default ''`. README's own SQL blocks are otherwise copied verbatim into migrations for traceability.

## Global Constraints

- File uploads: PDF only, 20MB max (README §3.1).
- `concept_id` format: `KSCA-{YYYY}-{NNNNNN}`, issued only via `generate_concept_id()` (README §3.2, §9).
- Report auto-hide threshold: exactly 3 accumulated `pending` reports on the same `(target_type, target_id)` (README §3.5, §10) — applies uniformly to `paper`, `post`, `comment`, `paper_comment`.
- Roles: `profiles.role` is `'user'` or `'admin'`; no school verification, school is free-text/nullable (README §2).
- Board categories: `free`, `question`, `study`, `notice` — only admins may post `notice` (README §4, §12 `posts_insert` policy).
- Admin access control is role-based (`profiles.role === 'admin'`), enforced server-side, **not** via route middleware, with RLS as the second line of defense (README §5.2).
- File storage: `papers` bucket is **private**; upload via `createSignedUploadUrl`, download via a fresh `createSignedUrl` per request, never persisted (README §7).
- Citation formats: both APA and BibTeX, auto-generated on the paper detail page (README §3.2).
- Paper comments persist across versions and show a "written at version N" badge (README §3.4).

---

## Phase 0 — Scaffold

### Task 1: Initialize Next.js project, Tailwind, shadcn/ui, base layout

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/globals.css` (via `create-next-app`)
- Create: `lib/types.ts`
- Create: `components/Nav.tsx`
- Create: `components/Footer.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `lib/types.ts` exports `Profile`, `Paper`, `PaperComment`, `Post`, `Comment`, `Report` types used by every later task that touches Supabase rows.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --use-npm
```

When prompted, accept defaults. If the directory isn't empty (README.md, install script, .claude/ already exist), answer to proceed anyway — it only adds new files.

- [ ] **Step 2: Initialize shadcn/ui and add the base components this project needs**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input textarea card badge dropdown-menu dialog select label separator
```

- [ ] **Step 3: Write `lib/types.ts`**

```typescript
// lib/types.ts
// Mirrors the DB schema in README.md §8 (plus the `authors` column added
// in migration 0002 — see docs/superpowers/plans/2026-09-05-ksca-web-service.md).

export type Role = 'user' | 'admin';
export type ContentStatus = 'public' | 'hidden';
export type ReportStatus = 'pending' | 'reviewed';
export type TargetType = 'paper' | 'post' | 'comment' | 'paper_comment';
export type BoardCategory = 'free' | 'question' | 'study' | 'notice';

export type Profile = {
  id: string;
  nickname: string;
  school: string | null;
  role: Role;
  created_at: string;
};

export type Paper = {
  id: string;
  concept_id: string;
  version_no: number;
  author_id: string;
  authors: string;
  title: string;
  abstract: string;
  tags: string[];
  school: string | null;
  file_path: string;
  view_count: number;
  status: ContentStatus;
  created_at: string;
};

export type PaperComment = {
  id: string;
  paper_id: string;
  author_id: string;
  content: string;
  written_at_version: number;
  status: ContentStatus;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  category: BoardCategory;
  title: string;
  content: string;
  status: ContentStatus;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  status: ContentStatus;
  created_at: string;
};

export type Report = {
  id: string;
  target_type: TargetType;
  target_id: string;
  reporter_id: string;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  created_at: string;
};
```

- [ ] **Step 4: Write `components/Nav.tsx` and `components/Footer.tsx` (static shell for now — made session-aware in Task 5)**

```tsx
// components/Nav.tsx
import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          KSCA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/papers">아카이브</Link>
          <Link href="/board">게시판</Link>
          <Link href="/login">로그인</Link>
        </nav>
      </div>
    </header>
  );
}
```

```tsx
// components/Footer.tsx
export function Footer() {
  return (
    <footer className="mt-16 border-t py-6 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} KSCA — Korea Student Computer science Association
    </footer>
  );
}
```

- [ ] **Step 5: Wire the shell into `app/layout.tsx`**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'KSCA',
  description: '전국 청소년 컴퓨터 사이언스 학회',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify the app builds and runs**

Run: `npm run build`
Expected: build succeeds with no type errors.

Run: `npm run dev` (then Ctrl+C once you've confirmed `http://localhost:3000` renders the shell)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Tailwind, shadcn/ui, base layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 2: Supabase CLI init + schema/function/trigger migrations

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/0001_schema.sql`
- Create: `supabase/migrations/0002_paper_authors_column.sql`
- Create: `supabase/migrations/0003_profile_on_signup.sql`
- Create: `supabase/migrations/0004_functions_triggers.sql`
- Create: `supabase/migrations/0005_rls.sql`

**Interfaces:**
- Produces: every table/column/function/trigger/policy that all later Server Actions and pages query against. This is the contract every later task's Supabase calls rely on.

- [ ] **Step 1: Initialize the Supabase project and start it locally**

```bash
npx supabase init
npx supabase start
```

Keep the printed `API URL`, `anon key`, and `service_role key` — they're needed in Task 4.

- [ ] **Step 2: Write `supabase/migrations/0001_schema.sql` (README §8, verbatim)**

```sql
-- 사용자 프로필 (Supabase Auth의 auth.users 확장)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  school text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 논문
create table papers (
  id uuid primary key default gen_random_uuid(),
  concept_id text not null,
  version_no int not null default 1,
  author_id uuid not null references profiles(id),
  title text not null,
  abstract text not null,
  tags text[] not null default '{}',
  school text,
  file_path text not null,
  view_count int not null default 0,
  status text not null default 'public' check (status in ('public', 'hidden')),
  created_at timestamptz not null default now()
);
create index on papers (concept_id);

-- 논문 댓글 (버전별 종속 + 작성 시점 버전 기록)
create table paper_comments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  author_id uuid not null references profiles(id),
  content text not null,
  written_at_version int not null,
  status text not null default 'public' check (status in ('public', 'hidden')),
  created_at timestamptz not null default now()
);

-- 게시판 글
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id),
  category text not null check (category in ('free', 'question', 'study', 'notice')),
  title text not null,
  content text not null,
  status text not null default 'public' check (status in ('public', 'hidden')),
  created_at timestamptz not null default now()
);

-- 게시판 댓글
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id),
  content text not null,
  status text not null default 'public' check (status in ('public', 'hidden')),
  created_at timestamptz not null default now()
);

-- 신고
create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('paper', 'post', 'comment', 'paper_comment')),
  target_id uuid not null,
  reporter_id uuid not null references profiles(id),
  reason text not null,
  detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now()
);

-- 연도별 concept_id 발급 카운터
create table paper_counters (
  year int primary key,
  last_seq int not null default 0
);
```

- [ ] **Step 3: Write `supabase/migrations/0002_paper_authors_column.sql` (documented deviation)**

```sql
-- README.md §3.1 describes an upload field for author name(s) that the
-- "final" schema in §8 omitted (only author_id, the uploader, exists).
-- This column is additive and does not change any README-specified
-- column, type, or constraint.
alter table papers add column authors text not null default '';
```

- [ ] **Step 4: Write `supabase/migrations/0003_profile_on_signup.sql`**

README doesn't specify how `profiles` rows get created; a DB trigger on `auth.users` is the most reliable option (works even if a post-signup client call never runs).

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, school)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'school'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

- [ ] **Step 5: Write `supabase/migrations/0004_functions_triggers.sql` (README §9-10, verbatim)**

```sql
create or replace function generate_concept_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year int := extract(year from now());
  next_seq int;
  new_id text;
begin
  insert into paper_counters (year, last_seq)
  values (current_year, 1)
  on conflict (year)
  do update set last_seq = paper_counters.last_seq + 1
  returning last_seq into next_seq;

  new_id := 'KSCA-' || current_year || '-' || lpad(next_seq::text, 6, '0');
  return new_id;
end;
$$;

create or replace function check_report_threshold()
returns trigger
language plpgsql
as $$
declare
  report_count int;
begin
  select count(*) into report_count
  from reports
  where target_type = new.target_type and target_id = new.target_id and status = 'pending';

  if report_count >= 3 then
    case new.target_type
      when 'paper' then
        update papers set status = 'hidden' where id = new.target_id;
      when 'post' then
        update posts set status = 'hidden' where id = new.target_id;
      when 'comment' then
        update comments set status = 'hidden' where id = new.target_id;
      when 'paper_comment' then
        update paper_comments set status = 'hidden' where id = new.target_id;
    end case;
  end if;

  return new;
end;
$$;

create trigger trg_report_threshold
after insert on reports
for each row execute function check_report_threshold();
```

- [ ] **Step 6: Write `supabase/migrations/0005_rls.sql` (README §12, verbatim)**

```sql
alter table profiles enable row level security;
alter table papers enable row level security;
alter table paper_comments enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table reports enable row level security;
alter table paper_counters enable row level security;

create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "papers_select" on papers for select
  using (
    status = 'public'
    or author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "papers_insert" on papers for insert
  with check (auth.uid() is not null and author_id = auth.uid());
create policy "papers_update_own_or_admin" on papers for update
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "paper_comments_select" on paper_comments for select
  using (
    status = 'public'
    or author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "paper_comments_insert" on paper_comments for insert
  with check (auth.uid() is not null and author_id = auth.uid());

create policy "posts_select" on posts for select
  using (
    status = 'public'
    or author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "posts_insert" on posts for insert
  with check (
    auth.uid() is not null and author_id = auth.uid()
    and (category != 'notice' or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  );
create policy "posts_update_own_or_admin" on posts for update
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "comments_select" on comments for select
  using (
    status = 'public'
    or author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "comments_insert" on comments for insert
  with check (auth.uid() is not null and author_id = auth.uid());

create policy "reports_select_own_or_admin" on reports for select
  using (
    reporter_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "reports_insert" on reports for insert
  with check (auth.uid() is not null and reporter_id = auth.uid());
create policy "reports_update_admin_only" on reports for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "paper_counters_no_direct_access" on paper_counters for all using (false);
```

- [ ] **Step 7: Apply the migrations**

```bash
npx supabase db reset
```

Expected: all 5 migrations apply cleanly with no errors.

- [ ] **Step 8: Verify `generate_concept_id()` issues sequential ids**

```bash
npx supabase db psql -c "select generate_concept_id(); select generate_concept_id();"
```

Expected: two rows like `KSCA-2026-000001` then `KSCA-2026-000002`.

- [ ] **Step 9: Verify the report-threshold trigger for the `paper` target type**

```bash
npx supabase db psql <<'SQL'
do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  u4 uuid := gen_random_uuid();
  p_id uuid;
begin
  insert into auth.users (id, email) values
    (u1, 'trigtest-author@example.com'),
    (u2, 'trigtest-r1@example.com'),
    (u3, 'trigtest-r2@example.com'),
    (u4, 'trigtest-r3@example.com');

  insert into papers (id, concept_id, author_id, title, abstract, file_path)
  values (gen_random_uuid(), generate_concept_id(), u1, 'test', 'test', 'test.pdf')
  returning id into p_id;

  insert into reports (target_type, target_id, reporter_id, reason) values
    ('paper', p_id, u2, 'spam'),
    ('paper', p_id, u3, 'spam'),
    ('paper', p_id, u4, 'spam');

  assert (select status from papers where id = p_id) = 'hidden',
    'expected paper to be auto-hidden after 3 pending reports';

  raise notice 'trigger test passed';
end $$;
SQL
```

Expected: `NOTICE: trigger test passed` with no assertion error. This is a manual smoke check now; Task 19 covers all four target types systematically.

- [ ] **Step 10: Commit**

```bash
git add supabase
git commit -m "Add Supabase schema, functions, triggers, and RLS migrations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 3: Seed data (auth users, papers, posts, comments) + sample PDF upload

**Files:**
- Create: `supabase/seed.sql`
- Create: `supabase/seed-storage.sh`

**Interfaces:**
- Consumes: schema from Task 2 (`profiles`, `papers`, `posts`, `comments`, `paper_comments`, `generate_concept_id()`, the `on_auth_user_created` trigger).
- Produces: a browsable database — 1 admin, 2 authors, one multi-version paper, one single-version paper, board posts across all 4 categories with comments — used to manually verify every later page.

- [ ] **Step 1: Write `supabase/seed.sql`**

```sql
-- Fixed UUIDs so this file is idempotent under `supabase db reset`.
-- Passwords are 'password123' for every seeded account (local dev only).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'admin@ksca.dev',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nickname":"운영진"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'author1@ksca.dev',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nickname":"김민준","school":"한빛고등학교"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'author2@ksca.dev',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nickname":"이서연"}', now(), now(), '', '', '', '');

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';

-- A multi-version paper (v1, v2 share concept_id)
do $$
declare
  cid text := generate_concept_id();
  v1_id uuid := gen_random_uuid();
  v2_id uuid := gen_random_uuid();
begin
  insert into papers (id, concept_id, version_no, author_id, authors, title, abstract, tags, school, file_path, status)
  values (
    v1_id, cid, 1, '22222222-2222-2222-2222-222222222222', '김민준',
    '청소년을 위한 강화학습 입문 실험', '간단한 그리드월드 환경에서 Q-learning의 수렴을 관찰한다.',
    array['AI', '강화학습'], '한빛고등학교', 'seed/rl-intro-v1.pdf', 'public'
  );
  insert into papers (id, concept_id, version_no, author_id, authors, title, abstract, tags, school, file_path, status)
  values (
    v2_id, cid, 2, '22222222-2222-2222-2222-222222222222', '김민준',
    '청소년을 위한 강화학습 입문 실험 (개정판)', '보상 함수를 조정하고 실험 표본 수를 늘려 재검증했다.',
    array['AI', '강화학습'], '한빛고등학교', 'seed/rl-intro-v2.pdf', 'public'
  );
  insert into paper_comments (paper_id, author_id, content, written_at_version)
  values (v1_id, '33333333-3333-3333-3333-333333333333', '흥미로운 접근이네요! 보상 함수는 어떻게 설계하셨나요?', 1);
  insert into paper_comments (paper_id, author_id, content, written_at_version)
  values (v2_id, '11111111-1111-1111-1111-111111111111', '개정판에서 재현성이 크게 좋아졌습니다.', 2);
end $$;

-- A single-version paper
insert into papers (concept_id, version_no, author_id, authors, title, abstract, tags, school, file_path, status)
values (
  generate_concept_id(), 1, '33333333-3333-3333-3333-333333333333', '이서연',
  '학교 급식 데이터로 보는 영양 불균형 분석', '전국 20개교 급식 데이터를 수집해 영양소 편차를 분석했다.',
  array['데이터분석'], null, 'seed/nutrition-analysis-v1.pdf', 'public'
);

-- Board posts across all categories
insert into posts (author_id, category, title, content, status) values
  ('22222222-2222-2222-2222-222222222222', 'free', '첫 논문 업로드했습니다', '피드백 환영합니다!', 'public'),
  ('33333333-3333-3333-3333-333333333333', 'question', 'RLS 정책 질문 있습니다', 'select 정책에서 author_id 체크는 어떻게 하나요?', 'public'),
  ('22222222-2222-2222-2222-222222222222', 'study', '알고리즘 스터디원 모집', '주 1회 온라인 스터디 진행합니다.', 'public'),
  ('11111111-1111-1111-1111-111111111111', 'notice', 'KSCA 서비스 오픈 안내', '아카이브와 게시판이 정식 오픈되었습니다.', 'public');

insert into comments (post_id, author_id, content, status)
select id, '11111111-1111-1111-1111-111111111111', '좋은 시작이네요, 축하합니다!', 'public'
from posts where title = '첫 논문 업로드했습니다';
```

- [ ] **Step 2: Write `supabase/seed-storage.sh` (uploads a tiny valid PDF to each seeded `file_path`)**

```bash
#!/usr/bin/env bash
# Uploads a minimal placeholder PDF to every seed paper's storage path so
# the signed-download flow works against seeded data too.
# Run AFTER `supabase start` (and after `supabase db reset` has applied seed.sql).
set -euo pipefail

STATUS=$(npx supabase status -o json)
API_URL=$(echo "$STATUS" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).API_URL")
SERVICE_KEY=$(echo "$STATUS" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).SERVICE_ROLE_KEY")

PDF_PATH="$(mktemp).pdf"
printf '%%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF' > "$PDF_PATH"

for path in seed/rl-intro-v1.pdf seed/rl-intro-v2.pdf seed/nutrition-analysis-v1.pdf; do
  curl -s -X POST "$API_URL/storage/v1/object/papers/$path" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/pdf" \
    --data-binary "@$PDF_PATH" > /dev/null
  echo "uploaded $path"
done

rm -f "$PDF_PATH"
```

- [ ] **Step 3: Create the private `papers` bucket, then apply seed + storage upload**

```bash
npx supabase db psql -c "insert into storage.buckets (id, name, public) values ('papers', 'papers', false) on conflict (id) do nothing;"
npx supabase db reset
chmod +x supabase/seed-storage.sh
./supabase/seed-storage.sh
```

Expected: `uploaded seed/...pdf` printed 3 times with no curl errors.

- [ ] **Step 4: Verify seeded data is queryable**

```bash
npx supabase db psql -c "select concept_id, version_no, title from papers order by concept_id, version_no;"
npx supabase db psql -c "select category, title from posts order by category;"
```

Expected: 3 paper rows (2 sharing one `concept_id`), 4 post rows across the 4 categories.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "Add seed data and storage upload script for sample papers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```
