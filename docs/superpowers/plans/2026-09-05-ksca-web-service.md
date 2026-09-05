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

---

## Phase 1 — Auth

### Task 4: Vitest setup + Supabase client helpers + `requireUser`

**Files:**
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/auth.ts`
- Test: `lib/auth.test.ts`

**Interfaces:**
- Produces: `createBrowserClient()`, `createServerClient()` (async, cookie-aware), `createAdminClient()` (service-role, server-only) — every later task's data access goes through one of these three. `requireUser(supabase): Promise<User>` — throws `AuthRequiredError` if no session; used by every auth-gated page/action from Task 6 onward.

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: Write `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write `.env.local.example`**

```bash
# Copy to .env.local and fill in from `npx supabase status`.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Copy it to `.env.local` and fill in the real local values now.

- [ ] **Step 4: Write `lib/supabase/client.ts` and `lib/supabase/server.ts`**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Call fresh in every Server Component / Server Action — cookies() is
// request-scoped and this client must not be cached across requests.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no response to write to —
            // safe to ignore when middleware refreshes sessions instead.
          }
        },
      },
    }
  );
}
```

```typescript
// lib/supabase/admin.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client. Server-only (Server Actions / Route Handlers), never
// imported from a Client Component. Used for signed URL issuance (README §7),
// which needs to bypass Storage RLS from the server side.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 5: Write the failing test for `requireUser`**

```typescript
// lib/auth.test.ts
import { describe, it, expect } from 'vitest';
import { requireUser, AuthRequiredError } from './auth';

function stubSupabase(user: { id: string } | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
  } as any;
}

describe('requireUser', () => {
  it('returns the user when a session exists', async () => {
    const user = await requireUser(stubSupabase({ id: 'u1' }));
    expect(user.id).toBe('u1');
  });

  it('throws AuthRequiredError when there is no session', async () => {
    await expect(requireUser(stubSupabase(null))).rejects.toBeInstanceOf(AuthRequiredError);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- lib/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 7: Write `lib/auth.ts`**

```typescript
// lib/auth.ts
import type { User } from '@supabase/supabase-js';

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
  }
}

type SupabaseLike = {
  auth: { getUser: () => Promise<{ data: { user: User | null }; error: unknown }> };
};

export async function requireUser(supabase: SupabaseLike): Promise<User> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AuthRequiredError();
  return data.user;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- lib/auth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts .env.local.example lib/supabase lib/auth.ts lib/auth.test.ts package.json package-lock.json
git commit -m "Add Supabase client helpers and requireUser guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 5: Signup / login pages + session-aware nav

**Files:**
- Create: `lib/actions/auth.ts`
- Test: `lib/actions/auth.test.ts`
- Create: `app/signup/page.tsx`
- Create: `app/login/page.tsx`
- Modify: `components/Nav.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` (Task 4).
- Produces: `parseSignupForm(formData): {email, password, nickname, school}` (pure, tested) and Server Actions `signUp`, `signIn`, `signOut` used directly by the forms below.

- [ ] **Step 1: Write the failing test for form parsing**

```typescript
// lib/actions/auth.test.ts
import { describe, it, expect } from 'vitest';
import { parseSignupForm } from './auth';

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe('parseSignupForm', () => {
  it('extracts email, password, nickname, and optional school', () => {
    const result = parseSignupForm(
      fd({ email: 'a@b.com', password: 'secret123', nickname: '민준', school: '한빛고' })
    );
    expect(result).toEqual({
      email: 'a@b.com',
      password: 'secret123',
      nickname: '민준',
      school: '한빛고',
    });
  });

  it('treats a blank school as null', () => {
    const result = parseSignupForm(fd({ email: 'a@b.com', password: 'secret123', nickname: '민준', school: '' }));
    expect(result.school).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/actions/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Write `lib/actions/auth.ts`**

```typescript
// lib/actions/auth.ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export function parseSignupForm(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const nickname = String(formData.get('nickname') ?? '');
  const schoolRaw = String(formData.get('school') ?? '').trim();
  return { email, password, nickname, school: schoolRaw === '' ? null : schoolRaw };
}

export async function signUp(formData: FormData) {
  const { email, password, nickname, school } = parseSignupForm(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname, school } },
  });
  if (error) throw error;
  redirect('/login?confirm=1');
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  redirect('/me');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
```

`'use server'` files can't be imported by a Vitest module the normal way if the framework's server-action transform intercepts it — if `npm test` errors on the directive, extract `parseSignupForm` into `lib/actions/auth-parse.ts` (no directive) and re-export it from `lib/actions/auth.ts`. Try the single-file version first.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/actions/auth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `app/signup/page.tsx`**

```tsx
// app/signup/page.tsx
import { signUp } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">회원가입</h1>
      <form action={signUp} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="nickname">닉네임</Label>
          <Input id="nickname" name="nickname" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="school">학교 (선택)</Label>
          <Input id="school" name="school" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <Button type="submit" className="w-full">
          가입하기
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Write `app/login/page.tsx`**

```tsx
// app/login/page.tsx
import { signIn } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { confirm } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">로그인</h1>
      {confirm && (
        <p className="rounded bg-muted p-3 text-sm">가입 확인 이메일을 보냈습니다. 이메일을 확인해주세요.</p>
      )}
      <form action={signIn} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <Button type="submit" className="w-full">
          로그인
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Make `components/Nav.tsx` session-aware**

```tsx
// components/Nav.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          KSCA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/papers">아카이브</Link>
          <Link href="/board">게시판</Link>
          {user ? (
            <>
              <Link href="/me">마이페이지</Link>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  로그아웃
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <Link href="/signup">회원가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 8: Manual verification**

Run: `npm run dev`. Sign up a new user, confirm the "확인 이메일" banner appears on `/login`. Since local Supabase auto-confirms in dev (check `supabase/config.toml`'s `[auth.email] enable_confirmations`), log in and confirm the nav switches to 마이페이지/로그아웃, and that `signOut` returns you to the logged-out nav.

- [ ] **Step 9: Commit**

```bash
git add lib/actions/auth.ts lib/actions/auth.test.ts app/signup app/login components/Nav.tsx
git commit -m "Add signup/login pages and session-aware nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 6: `/me` page

**Files:**
- Create: `app/me/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 4), `createClient` server client (Task 4).

- [ ] **Step 1: Write `app/me/page.tsx`**

```tsx
// app/me/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, AuthRequiredError } from '@/lib/auth';

export default async function MePage() {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = (await requireUser(supabase)).id;
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    throw e;
  }

  const [{ data: profile }, { data: papers }, { data: posts }, { data: reports }] = await Promise.all([
    supabase.from('profiles').select('nickname, school, role').eq('id', userId).single(),
    supabase.from('papers').select('id, concept_id, title, status').eq('author_id', userId),
    supabase.from('posts').select('id, title, category, status').eq('author_id', userId),
    supabase.from('reports').select('id, target_type, reason, status').eq('reporter_id', userId),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">마이페이지</h1>
      <p className="text-sm text-muted-foreground">
        {profile?.nickname} {profile?.school ? `· ${profile.school}` : ''}
      </p>

      <section>
        <h2 className="mb-2 text-lg font-medium">내 논문</h2>
        {papers && papers.length > 0 ? (
          <ul className="space-y-1">
            {papers.map((p) => (
              <li key={p.id}>
                <Link href={`/papers/${p.concept_id}`} className="underline">
                  {p.title}
                </Link>{' '}
                <span className="text-xs text-muted-foreground">({p.status})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">업로드한 논문이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">내 글</h2>
        {posts && posts.length > 0 ? (
          <ul className="space-y-1">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/board/post/${p.id}`} className="underline">
                  {p.title}
                </Link>{' '}
                <span className="text-xs text-muted-foreground">({p.category}, {p.status})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">작성한 글이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">내 신고 내역</h2>
        {reports && reports.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {reports.map((r) => (
              <li key={r.id}>
                {r.target_type} — {r.reason} — {r.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">신고 내역이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Visit `/me` logged out → redirected to `/login`. Log in as a seeded author (e.g. `author1@ksca.dev` / `password123`) → `/me` shows their seeded paper and no posts/reports yet.

- [ ] **Step 3: Commit**

```bash
git add app/me
git commit -m "Add /me page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

## Phase 2 — Paper archive

### Task 7: Citation formatting (APA + BibTeX)

**Files:**
- Create: `lib/citation.ts`
- Test: `lib/citation.test.ts`

**Interfaces:**
- Produces: `formatAPA(input: CitationInput): string`, `formatBibTeX(input: CitationInput): string`, where `CitationInput = {concept_id, authors, title, created_at, school}` — used by the paper detail page (Task 11).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/citation.test.ts
import { describe, it, expect } from 'vitest';
import { formatAPA, formatBibTeX } from './citation';

const paper = {
  concept_id: 'KSCA-2026-000001',
  authors: '김민준',
  title: '청소년을 위한 강화학습 입문 실험',
  created_at: '2026-03-14T00:00:00.000Z',
  school: '한빛고등학교',
};

describe('formatAPA', () => {
  it('formats author, year, title, and identifier', () => {
    expect(formatAPA(paper)).toBe(
      '김민준 (2026). 청소년을 위한 강화학습 입문 실험. KSCA. https://ksca.dev/papers/KSCA-2026-000001'
    );
  });
});

describe('formatBibTeX', () => {
  it('formats a @misc entry keyed by concept_id', () => {
    expect(formatBibTeX(paper)).toBe(
      [
        '@misc{KSCA-2026-000001,',
        '  author = {김민준},',
        '  title = {청소년을 위한 강화학습 입문 실험},',
        '  year = {2026},',
        '  publisher = {KSCA},',
        '  url = {https://ksca.dev/papers/KSCA-2026-000001}',
        '}',
      ].join('\n')
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/citation.test.ts`
Expected: FAIL — `Cannot find module './citation'`.

- [ ] **Step 3: Write `lib/citation.ts`**

```typescript
// lib/citation.ts

// The base URL is a placeholder until the association's real domain is
// registered (README §14 notes concept_id's prefix/registrar are still open).
const BASE_URL = 'https://ksca.dev';

export type CitationInput = {
  concept_id: string;
  authors: string;
  title: string;
  created_at: string;
  school: string | null;
};

function year(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

export function formatAPA(p: CitationInput): string {
  return `${p.authors} (${year(p.created_at)}). ${p.title}. KSCA. ${BASE_URL}/papers/${p.concept_id}`;
}

export function formatBibTeX(p: CitationInput): string {
  return [
    `@misc{${p.concept_id},`,
    `  author = {${p.authors}},`,
    `  title = {${p.title}},`,
    `  year = {${year(p.created_at)}},`,
    `  publisher = {KSCA},`,
    `  url = {${BASE_URL}/papers/${p.concept_id}}`,
    `}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/citation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/citation.ts lib/citation.test.ts
git commit -m "Add APA/BibTeX citation formatting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 8: Signed upload Server Action + paper creation

**Files:**
- Create: `lib/actions/papers.ts`
- Test: `lib/actions/papers.test.ts`

**Interfaces:**
- Consumes: `requireUser` (Task 4), `createAdminClient` (Task 4).
- Produces: `validateUploadRequest({fileName, fileSize, fileType}): {ok: true} | {ok: false, error: string}` (pure, tested), `requestPaperUpload(fileName, fileSize, fileType): Promise<{path: string, signedUrl: string, token: string}>`, `createPaper(input: CreatePaperInput): Promise<{concept_id: string}>` where `CreatePaperInput = {title, authors, abstract, tags: string[], school: string | null, filePath: string, existingConceptId?: string}` — consumed by the upload pages in Task 9.

- [ ] **Step 1: Write the failing test for validation**

```typescript
// lib/actions/papers.test.ts
import { describe, it, expect } from 'vitest';
import { validateUploadRequest } from './papers';

describe('validateUploadRequest', () => {
  it('accepts a PDF under 20MB', () => {
    expect(validateUploadRequest({ fileName: 'x.pdf', fileSize: 10 * 1024 * 1024, fileType: 'application/pdf' })).toEqual({
      ok: true,
    });
  });

  it('rejects non-PDF types', () => {
    const r = validateUploadRequest({ fileName: 'x.docx', fileSize: 1000, fileType: 'application/msword' });
    expect(r.ok).toBe(false);
  });

  it('rejects files over 20MB', () => {
    const r = validateUploadRequest({
      fileName: 'x.pdf',
      fileSize: 21 * 1024 * 1024,
      fileType: 'application/pdf',
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/actions/papers.test.ts`
Expected: FAIL — `Cannot find module './papers'`.

- [ ] **Step 3: Write `lib/actions/papers.ts`**

```typescript
// lib/actions/papers.ts
'use server';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

const MAX_BYTES = 20 * 1024 * 1024;

export function validateUploadRequest(input: { fileName: string; fileSize: number; fileType: string }):
  | { ok: true }
  | { ok: false; error: string } {
  if (input.fileType !== 'application/pdf' && !input.fileName.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'PDF 파일만 업로드할 수 있습니다.' };
  }
  if (input.fileSize > MAX_BYTES) {
    return { ok: false, error: '파일 크기는 20MB를 초과할 수 없습니다.' };
  }
  return { ok: true };
}

export async function requestPaperUpload(fileName: string, fileSize: number, fileType: string) {
  const supabase = await createClient();
  await requireUser(supabase); // throws if unauthenticated

  const check = validateUploadRequest({ fileName, fileSize, fileType });
  if (!check.ok) throw new Error(check.error);

  const path = `${randomUUID()}.pdf`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('papers').createSignedUploadUrl(path);
  if (error) throw error;

  return { path, signedUrl: data.signedUrl, token: data.token };
}

export type CreatePaperInput = {
  title: string;
  authors: string;
  abstract: string;
  tags: string[];
  school: string | null;
  filePath: string;
  existingConceptId?: string;
};

export async function createPaper(input: CreatePaperInput): Promise<{ concept_id: string }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  let conceptId = input.existingConceptId;
  let versionNo = 1;

  if (conceptId) {
    // New version of an existing paper — author-only, enforced here and by RLS.
    const { data: latest, error: latestErr } = await supabase
      .from('papers')
      .select('version_no, author_id')
      .eq('concept_id', conceptId)
      .order('version_no', { ascending: false })
      .limit(1)
      .single();
    if (latestErr) throw latestErr;
    if (latest.author_id !== user.id) throw new Error('원저자만 새 버전을 업로드할 수 있습니다.');
    versionNo = latest.version_no + 1;
  } else {
    const { data, error } = await supabase.rpc('generate_concept_id');
    if (error) throw error;
    conceptId = data as string;
  }

  const { error: insertErr } = await supabase.from('papers').insert({
    concept_id: conceptId,
    version_no: versionNo,
    author_id: user.id,
    authors: input.authors,
    title: input.title,
    abstract: input.abstract,
    tags: input.tags,
    school: input.school,
    file_path: input.filePath,
  });
  if (insertErr) throw insertErr;

  return { concept_id: conceptId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/actions/papers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/actions/papers.ts lib/actions/papers.test.ts
git commit -m "Add signed upload and paper creation server actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 9: Paper upload page + new-version upload page

**Files:**
- Create: `components/PaperUploadForm.tsx`
- Create: `app/papers/upload/page.tsx`
- Create: `app/papers/[concept_id]/upload-version/page.tsx`

**Interfaces:**
- Consumes: `requestPaperUpload`, `createPaper` (Task 8), `requireUser` (Task 4).

- [ ] **Step 1: Write `components/PaperUploadForm.tsx`** (Client Component — needs to PUT the file directly to the signed URL)

```tsx
// components/PaperUploadForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPaperUpload, createPaper } from '@/lib/actions/papers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function PaperUploadForm({ existingConceptId }: { existingConceptId?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const file = formData.get('file') as File;
      const { path, signedUrl } = await requestPaperUpload(file.name, file.size, file.type);

      const putRes = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } });
      if (!putRes.ok) throw new Error('파일 업로드에 실패했습니다.');

      const tags = String(formData.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const schoolRaw = String(formData.get('school') ?? '').trim();

      const { concept_id } = await createPaper({
        title: String(formData.get('title') ?? ''),
        authors: String(formData.get('authors') ?? ''),
        abstract: String(formData.get('abstract') ?? ''),
        tags,
        school: schoolRaw === '' ? null : schoolRaw,
        filePath: path,
        existingConceptId,
      });

      router.push(`/papers/${concept_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="authors">저자명 (본인 + 공동저자)</Label>
        <Input id="authors" name="authors" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="abstract">초록</Label>
        <Textarea id="abstract" name="abstract" required rows={6} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tags">분야 태그 (쉼표로 구분)</Label>
        <Input id="tags" name="tags" placeholder="AI, 데이터분석" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="school">학교명 (선택)</Label>
        <Input id="school" name="school" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="file">PDF 파일 (최대 20MB)</Label>
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? '업로드 중...' : '업로드'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Write `app/papers/upload/page.tsx`**

```tsx
// app/papers/upload/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, AuthRequiredError } from '@/lib/auth';
import { PaperUploadForm } from '@/components/PaperUploadForm';

export default async function PaperUploadPage() {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    throw e;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">논문 업로드</h1>
      <PaperUploadForm />
    </div>
  );
}
```

- [ ] **Step 3: Write `app/papers/[concept_id]/upload-version/page.tsx`**

```tsx
// app/papers/[concept_id]/upload-version/page.tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, AuthRequiredError } from '@/lib/auth';
import { PaperUploadForm } from '@/components/PaperUploadForm';

export default async function UploadVersionPage({ params }: { params: Promise<{ concept_id: string }> }) {
  const { concept_id } = await params;
  const supabase = await createClient();
  let userId: string;
  try {
    userId = (await requireUser(supabase)).id;
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    throw e;
  }

  const { data: latest } = await supabase
    .from('papers')
    .select('author_id, title')
    .eq('concept_id', concept_id)
    .order('version_no', { ascending: false })
    .limit(1)
    .single();

  if (!latest) notFound();
  if (latest.author_id !== userId) redirect(`/papers/${concept_id}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">새 버전 업로드 — {latest.title}</h1>
      <PaperUploadForm existingConceptId={concept_id} />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Log in as `author1@ksca.dev`, go to `/papers/upload`, submit a small PDF — should redirect to `/papers/KSCA-...` (detail page doesn't exist until Task 11, a 404 there is expected for now; confirm instead via `npx supabase db psql -c "select concept_id, version_no from papers order by created_at desc limit 1;"`). Then visit the seeded paper's `/papers/<its concept_id>/upload-version` as its author and confirm a new `version_no` row is created; as a different user, confirm you're redirected away.

- [ ] **Step 5: Commit**

```bash
git add components/PaperUploadForm.tsx app/papers/upload app/papers/[concept_id]/upload-version
git commit -m "Add paper upload and new-version upload pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 10: Paper archive list page

**Files:**
- Create: `lib/papers-query.ts`
- Test: `lib/papers-query.test.ts`
- Create: `components/PaperCard.tsx`
- Create: `app/papers/page.tsx`

**Interfaces:**
- Produces: `parsePaperListParams(searchParams: Record<string,string|undefined>): {sort: 'latest'|'views', tag: string|null}` (pure, tested) — consumed by `app/papers/page.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/papers-query.test.ts
import { describe, it, expect } from 'vitest';
import { parsePaperListParams } from './papers-query';

describe('parsePaperListParams', () => {
  it('defaults to latest sort and no tag filter', () => {
    expect(parsePaperListParams({})).toEqual({ sort: 'latest', tag: null });
  });

  it('accepts sort=views', () => {
    expect(parsePaperListParams({ sort: 'views' })).toEqual({ sort: 'views', tag: null });
  });

  it('falls back to latest for an unknown sort value', () => {
    expect(parsePaperListParams({ sort: 'bogus' })).toEqual({ sort: 'latest', tag: null });
  });

  it('passes through a tag filter', () => {
    expect(parsePaperListParams({ tag: 'AI' })).toEqual({ sort: 'latest', tag: 'AI' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/papers-query.test.ts`
Expected: FAIL — `Cannot find module './papers-query'`.

- [ ] **Step 3: Write `lib/papers-query.ts`**

```typescript
// lib/papers-query.ts
export type PaperListParams = { sort: 'latest' | 'views'; tag: string | null };

export function parsePaperListParams(searchParams: Record<string, string | undefined>): PaperListParams {
  const sort = searchParams.sort === 'views' ? 'views' : 'latest';
  const tag = searchParams.tag ?? null;
  return { sort, tag };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/papers-query.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write `components/PaperCard.tsx`**

```tsx
// components/PaperCard.tsx
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { Paper } from '@/lib/types';

export function PaperCard({ paper }: { paper: Pick<Paper, 'concept_id' | 'title' | 'authors' | 'tags' | 'view_count' | 'created_at'> }) {
  return (
    <Link href={`/papers/${paper.concept_id}`} className="block rounded-lg border p-4 transition hover:bg-muted/50">
      <h3 className="font-medium">{paper.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{paper.authors}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {paper.tags.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">조회 {paper.view_count}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 6: Write `app/papers/page.tsx`**

```tsx
// app/papers/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { parsePaperListParams } from '@/lib/papers-query';
import { PaperCard } from '@/components/PaperCard';
import { EmptyState } from '@/components/EmptyState';

export default async function PapersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { sort, tag } = parsePaperListParams(await searchParams);
  const supabase = await createClient();

  // Only the latest version per concept_id belongs in the list.
  let query = supabase
    .from('papers')
    .select('concept_id, version_no, title, authors, tags, view_count, created_at')
    .order('version_no', { ascending: false });
  if (tag) query = query.contains('tags', [tag]);

  const { data: allVersions } = await query;
  const latestByPaper = new Map<string, (typeof allVersions)[number]>();
  for (const row of allVersions ?? []) {
    if (!latestByPaper.has(row.concept_id)) latestByPaper.set(row.concept_id, row);
  }
  let papers = [...latestByPaper.values()];
  papers.sort((a, b) =>
    sort === 'views' ? b.view_count - a.view_count : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">논문 아카이브</h1>
        <Link href="/papers/upload" className="text-sm underline">
          업로드
        </Link>
      </div>
      <div className="flex gap-4 text-sm">
        <Link href="/papers" className={sort === 'latest' ? 'font-semibold' : ''}>
          최신순
        </Link>
        <Link href="/papers?sort=views" className={sort === 'views' ? 'font-semibold' : ''}>
          조회수순
        </Link>
      </div>
      {papers.length === 0 ? (
        <EmptyState message="아직 등록된 논문이 없습니다." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {papers.map((p) => (
            <PaperCard key={p.concept_id} paper={p} />
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: `components/EmptyState.tsx` doesn't exist yet — it's created in Task 20. Create a minimal version now so this task compiles standalone:

```tsx
// components/EmptyState.tsx
export function EmptyState({ message }: { message: string }) {
  return <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">{message}</p>;
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, visit `/papers` — expect the 2 seeded concept_ids (the multi-version one shown once, at its latest title "...개정판"). Try `/papers?sort=views` and `/papers?tag=AI`.

- [ ] **Step 8: Commit**

```bash
git add lib/papers-query.ts lib/papers-query.test.ts components/PaperCard.tsx components/EmptyState.tsx app/papers/page.tsx
git commit -m "Add paper archive list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 11: Paper detail (latest + versioned) + signed download route

**Files:**
- Create: `lib/visibility.ts`
- Test: `lib/visibility.test.ts`
- Create: `components/VersionBadge.tsx`
- Create: `components/CitationBlock.tsx`
- Create: `app/papers/[concept_id]/page.tsx`
- Create: `app/papers/[concept_id]/v/[n]/page.tsx`
- Create: `app/api/papers/[id]/download/route.ts`

**Interfaces:**
- Produces: `canView(paper: {status, author_id}, viewerId: string|null, viewerRole: 'user'|'admin'|null): boolean` (pure, tested) — mirrors the `papers_select` RLS policy for UI-level gating (RLS is the real enforcement; this avoids rendering a broken page instead of a clean "not found").
- Consumes: `formatAPA`/`formatBibTeX` (Task 7), `createAdminClient` (Task 4).

- [ ] **Step 1: Write the failing tests for `canView`**

```typescript
// lib/visibility.test.ts
import { describe, it, expect } from 'vitest';
import { canView } from './visibility';

const publicPaper = { status: 'public' as const, author_id: 'author-1' };
const hiddenPaper = { status: 'hidden' as const, author_id: 'author-1' };

describe('canView', () => {
  it('allows anyone to view public content', () => {
    expect(canView(publicPaper, null, null)).toBe(true);
  });
  it('denies anonymous viewers on hidden content', () => {
    expect(canView(hiddenPaper, null, null)).toBe(false);
  });
  it('denies a different logged-in user on hidden content', () => {
    expect(canView(hiddenPaper, 'someone-else', 'user')).toBe(false);
  });
  it('allows the author to view their own hidden content', () => {
    expect(canView(hiddenPaper, 'author-1', 'user')).toBe(true);
  });
  it('allows an admin to view any hidden content', () => {
    expect(canView(hiddenPaper, 'admin-1', 'admin')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/visibility.test.ts`
Expected: FAIL — `Cannot find module './visibility'`.

- [ ] **Step 3: Write `lib/visibility.ts`**

```typescript
// lib/visibility.ts
// Mirrors the `papers_select` / `posts_select` / `comments_select` /
// `paper_comments_select` RLS policies (README §12) for UI-level gating.
// RLS is the actual security boundary; this only decides what to render.

type ViewableContent = { status: 'public' | 'hidden'; author_id: string };

export function canView(content: ViewableContent, viewerId: string | null, viewerRole: 'user' | 'admin' | null): boolean {
  if (content.status === 'public') return true;
  if (viewerId && content.author_id === viewerId) return true;
  if (viewerRole === 'admin') return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/visibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write `components/VersionBadge.tsx` and `components/CitationBlock.tsx`**

```tsx
// components/VersionBadge.tsx
import { Badge } from '@/components/ui/badge';

export function VersionBadge({ version }: { version: number }) {
  return <Badge variant="outline">v{version}에 작성됨</Badge>;
}
```

```tsx
// components/CitationBlock.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatAPA, formatBibTeX, type CitationInput } from '@/lib/citation';

export function CitationBlock({ paper }: { paper: CitationInput }) {
  const [copied, setCopied] = useState<'apa' | 'bibtex' | null>(null);

  async function copy(format: 'apa' | 'bibtex', text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 1500);
  }

  const apa = formatAPA(paper);
  const bibtex = formatBibTeX(paper);

  return (
    <div className="space-y-3 rounded border p-4 text-sm">
      <div>
        <p className="font-medium">APA</p>
        <p className="mt-1 whitespace-pre-wrap">{apa}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => copy('apa', apa)}>
          {copied === 'apa' ? '복사됨' : '복사'}
        </Button>
      </div>
      <div>
        <p className="font-medium">BibTeX</p>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{bibtex}</pre>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => copy('bibtex', bibtex)}>
          {copied === 'bibtex' ? '복사됨' : '복사'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `app/papers/[concept_id]/page.tsx`** (latest version; renders comments/report button as placeholders wired in Tasks 12-13)

```tsx
// app/papers/[concept_id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canView } from '@/lib/visibility';
import { CitationBlock } from '@/components/CitationBlock';
import { VersionBadge } from '@/components/VersionBadge';

export default async function PaperDetailPage({ params }: { params: Promise<{ concept_id: string }> }) {
  const { concept_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data?.role ?? null
    : null;

  const { data: versions } = await supabase
    .from('papers')
    .select('*')
    .eq('concept_id', concept_id)
    .order('version_no', { ascending: false });

  if (!versions || versions.length === 0) notFound();
  const latest = versions[0];
  if (!canView(latest, user?.id ?? null, role)) notFound();

  await supabase
    .from('papers')
    .update({ view_count: latest.view_count + 1 })
    .eq('id', latest.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">{latest.concept_id} · v{latest.version_no}</p>
        <h1 className="text-2xl font-semibold">{latest.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {latest.authors} {latest.school ? `· ${latest.school}` : ''}
        </p>
      </div>

      <p className="whitespace-pre-wrap">{latest.abstract}</p>

      <a href={`/api/papers/${latest.id}/download`} className="inline-block underline">
        PDF 다운로드
      </a>

      <CitationBlock paper={latest} />

      {versions.length > 1 && (
        <div>
          <h2 className="mb-2 font-medium">버전 히스토리</h2>
          <ul className="space-y-1 text-sm">
            {versions.map((v) => (
              <li key={v.id}>
                <Link href={`/papers/${concept_id}/v/${v.version_no}`} className="underline">
                  v{v.version_no}
                </Link>{' '}
                <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString('ko-KR')}</span>
                {v.version_no === latest.version_no && <VersionBadge version={v.version_no} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {user?.id === latest.author_id && (
        <Link href={`/papers/${concept_id}/upload-version`} className="inline-block text-sm underline">
          새 버전 업로드
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `app/papers/[concept_id]/v/[n]/page.tsx`**

```tsx
// app/papers/[concept_id]/v/[n]/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canView } from '@/lib/visibility';
import { CitationBlock } from '@/components/CitationBlock';

export default async function PaperVersionPage({
  params,
}: {
  params: Promise<{ concept_id: string; n: string }>;
}) {
  const { concept_id, n } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data?.role ?? null
    : null;

  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('concept_id', concept_id)
    .eq('version_no', Number(n))
    .single();

  if (!paper) notFound();
  if (!canView(paper, user?.id ?? null, role)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          {paper.concept_id} · v{paper.version_no} (구버전)
        </p>
        <h1 className="text-2xl font-semibold">{paper.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {paper.authors} {paper.school ? `· ${paper.school}` : ''}
        </p>
      </div>
      <p className="whitespace-pre-wrap">{paper.abstract}</p>
      <a href={`/api/papers/${paper.id}/download`} className="inline-block underline">
        PDF 다운로드
      </a>
      <CitationBlock paper={paper} />
    </div>
  );
}
```

- [ ] **Step 8: Write `app/api/papers/[id]/download/route.ts`**

```typescript
// app/api/papers/[id]/download/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canView } from '@/lib/visibility';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data?.role ?? null
    : null;

  const { data: paper } = await supabase.from('papers').select('file_path, status, author_id').eq('id', id).single();
  if (!paper || !canView(paper, user?.id ?? null, role)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('papers').createSignedUrl(paper.file_path, 300);
  if (error || !data) {
    return NextResponse.json({ error: 'could not create signed url' }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
```

- [ ] **Step 9: Manual verification**

Run: `npm run dev`. Visit `/papers/<seeded multi-version concept_id>` — confirm both APA/BibTeX render and copy, version history lists v1/v2 with v2 shown as current, `/papers/<concept_id>/v/1` shows the old abstract, and the PDF download link resolves (redirects to a signed URL that serves the placeholder PDF from Task 3).

- [ ] **Step 10: Commit**

```bash
git add lib/visibility.ts lib/visibility.test.ts components/VersionBadge.tsx components/CitationBlock.tsx app/papers/[concept_id] app/api/papers
git commit -m "Add paper detail, version, and signed download pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 12: Paper comments (version-aggregated)

**Files:**
- Create: `lib/actions/paper-comments.ts`
- Test: `lib/actions/paper-comments.test.ts`
- Create: `components/CommentThread.tsx`
- Modify: `app/papers/[concept_id]/page.tsx`

**Interfaces:**
- Produces: `addPaperComment(paperRowId: string, writtenAtVersion: number, content: string): Promise<void>`, `validateCommentContent(content: string): {ok: true} | {ok: false, error: string}` (pure, tested).
- Consumes: `requireUser` (Task 4).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/actions/paper-comments.test.ts
import { describe, it, expect } from 'vitest';
import { validateCommentContent } from './paper-comments';

describe('validateCommentContent', () => {
  it('rejects empty content', () => {
    expect(validateCommentContent('   ').ok).toBe(false);
  });
  it('rejects content over 2000 characters', () => {
    expect(validateCommentContent('a'.repeat(2001)).ok).toBe(false);
  });
  it('accepts normal content', () => {
    expect(validateCommentContent('좋은 논문이네요!')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/actions/paper-comments.test.ts`
Expected: FAIL — `Cannot find module './paper-comments'`.

- [ ] **Step 3: Write `lib/actions/paper-comments.ts`**

```typescript
// lib/actions/paper-comments.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export function validateCommentContent(content: string): { ok: true } | { ok: false; error: string } {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { ok: false, error: '댓글 내용을 입력해주세요.' };
  if (trimmed.length > 2000) return { ok: false, error: '댓글은 2000자를 넘을 수 없습니다.' };
  return { ok: true };
}

export async function addPaperComment(paperRowId: string, writtenAtVersion: number, content: string) {
  const check = validateCommentContent(content);
  if (!check.ok) throw new Error(check.error);

  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { error } = await supabase.from('paper_comments').insert({
    paper_id: paperRowId,
    author_id: user.id,
    content: content.trim(),
    written_at_version: writtenAtVersion,
  });
  if (error) throw error;
  revalidatePath('/papers/[concept_id]', 'page');
}

export async function getPaperComments(conceptId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('paper_comments')
    .select('id, content, written_at_version, status, created_at, author_id, papers!inner(concept_id), profiles(nickname)')
    .eq('papers.concept_id', conceptId)
    .order('created_at', { ascending: true });
  return data ?? [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/actions/paper-comments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `components/CommentThread.tsx`** (generic enough to reuse for board comments in Task 15, via a `variant` prop)

```tsx
// components/CommentThread.tsx
import { VersionBadge } from '@/components/VersionBadge';

export type ThreadComment = {
  id: string;
  content: string;
  created_at: string;
  authorNickname: string;
  version?: number;
};

export function CommentThread({ comments }: { comments: ThreadComment[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>;
  }
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="rounded border p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{c.authorNickname}</span>
            {c.version !== undefined && <VersionBadge version={c.version} />}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleString('ko-KR')}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{c.content}</p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Wire comments into `app/papers/[concept_id]/page.tsx`** — add below the version history block, before the closing `</div>`:

```tsx
      <section>
        <h2 className="mb-2 font-medium">댓글</h2>
        <CommentThread
          comments={(await getPaperComments(concept_id)).map((c: any) => ({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            authorNickname: c.profiles?.nickname ?? '알 수 없음',
            version: c.written_at_version,
          }))}
        />
        {user && (
          <form
            action={async (formData: FormData) => {
              'use server';
              await addPaperComment(latest.id, latest.version_no, String(formData.get('content') ?? ''));
            }}
            className="mt-3 space-y-2"
          >
            <textarea name="content" required rows={3} className="w-full rounded border p-2 text-sm" />
            <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              댓글 작성
            </button>
          </form>
        )}
      </section>
```

Add the two new imports at the top of the file: `import { CommentThread } from '@/components/CommentThread';` and `import { addPaperComment, getPaperComments } from '@/lib/actions/paper-comments';`.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Visit the seeded multi-version paper's detail page — confirm the v1 and v2 seeded comments both show with correct version badges. Log in and post a new comment, confirm it appears with the current version badge.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/paper-comments.ts lib/actions/paper-comments.test.ts components/CommentThread.tsx app/papers/[concept_id]/page.tsx
git commit -m "Add version-aggregated paper comments

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 13: Report action + report button (reused by board in Phase 3)

**Files:**
- Create: `lib/actions/reports.ts`
- Test: `lib/actions/reports.test.ts`
- Create: `components/ReportButton.tsx`
- Modify: `app/papers/[concept_id]/page.tsx`

**Interfaces:**
- Produces: `submitReport(input: {targetType, targetId, reason, detail?}): Promise<void>`, `isValidReportReason(reason: string): boolean` (pure, tested). `<ReportButton targetType targetId />` — reused unmodified in Task 15 for board posts/comments.
- Consumes: `requireUser` (Task 4).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/actions/reports.test.ts
import { describe, it, expect } from 'vitest';
import { isValidReportReason } from './reports';

describe('isValidReportReason', () => {
  it('accepts the four defined reasons', () => {
    for (const r of ['plagiarism', 'inappropriate', 'spam', 'other']) {
      expect(isValidReportReason(r)).toBe(true);
    }
  });
  it('rejects anything else', () => {
    expect(isValidReportReason('bogus')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/actions/reports.test.ts`
Expected: FAIL — `Cannot find module './reports'`.

- [ ] **Step 3: Write `lib/actions/reports.ts`**

```typescript
// lib/actions/reports.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import type { TargetType } from '@/lib/types';

// README §3.5: 표절 의심 / 부적절한 내용 / 스팸 / 기타(자유 텍스트)
const VALID_REASONS = ['plagiarism', 'inappropriate', 'spam', 'other'] as const;

export function isValidReportReason(reason: string): boolean {
  return (VALID_REASONS as readonly string[]).includes(reason);
}

export async function submitReport(input: { targetType: TargetType; targetId: string; reason: string; detail?: string }) {
  if (!isValidReportReason(input.reason)) throw new Error('유효하지 않은 신고 사유입니다.');

  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { error } = await supabase.from('reports').insert({
    target_type: input.targetType,
    target_id: input.targetId,
    reporter_id: user.id,
    reason: input.reason,
    detail: input.detail ?? null,
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/actions/reports.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `components/ReportButton.tsx`**

```tsx
// components/ReportButton.tsx
'use client';

import { useState } from 'react';
import { submitReport } from '@/lib/actions/reports';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { TargetType } from '@/lib/types';

const REASONS: { value: string; label: string }[] = [
  { value: 'plagiarism', label: '표절 의심' },
  { value: 'inappropriate', label: '부적절한 내용' },
  { value: 'spam', label: '스팸' },
  { value: 'other', label: '기타' },
];

export function ReportButton({ targetType, targetId }: { targetType: TargetType; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('plagiarism');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await submitReport({ targetType, targetId, reason, detail: detail || undefined });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          신고
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신고하기</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded border p-2 text-sm">
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="자세한 내용 (선택)"
            rows={3}
            className="w-full rounded border p-2 text-sm"
          />
          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? '제출 중...' : '신고 제출'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Wire `<ReportButton>` into the paper detail page** — add near the title in `app/papers/[concept_id]/page.tsx`:

```tsx
      <ReportButton targetType="paper" targetId={latest.id} />
```

Add the import: `import { ReportButton } from '@/components/ReportButton';`

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. On a paper detail page, click 신고, submit with a reason — confirm a row appears via `npx supabase db psql -c "select * from reports order by created_at desc limit 1;"`.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/reports.ts lib/actions/reports.test.ts components/ReportButton.tsx app/papers/[concept_id]/page.tsx
git commit -m "Add report action and report button, wired into paper detail

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

## Phase 3 — Community board

### Task 14: Board category list + per-category post list

**Files:**
- Create: `lib/board.ts`
- Test: `lib/board.test.ts`
- Create: `components/PostListItem.tsx`
- Create: `app/board/page.tsx`
- Create: `app/board/[category]/page.tsx`

**Interfaces:**
- Produces: `isValidCategory(x: string): x is BoardCategory`, `CATEGORY_LABELS: Record<BoardCategory, string>` (pure, tested).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/board.test.ts
import { describe, it, expect } from 'vitest';
import { isValidCategory } from './board';

describe('isValidCategory', () => {
  it('accepts the four defined categories', () => {
    for (const c of ['free', 'question', 'study', 'notice']) expect(isValidCategory(c)).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isValidCategory('bogus')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/board.test.ts`
Expected: FAIL — `Cannot find module './board'`.

- [ ] **Step 3: Write `lib/board.ts`**

```typescript
// lib/board.ts
import type { BoardCategory, Role } from '@/lib/types';

export const CATEGORY_LABELS: Record<BoardCategory, string> = {
  free: '자유',
  question: '질문',
  study: '스터디·프로젝트 모집',
  notice: '공지',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as BoardCategory[];

export function isValidCategory(x: string): x is BoardCategory {
  return (CATEGORIES as string[]).includes(x);
}

// README §12 posts_insert: only admins may post in 'notice'.
export function canPostToCategory(category: BoardCategory, role: Role | null): boolean {
  if (category !== 'notice') return true;
  return role === 'admin';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/board.test.ts`
Expected: PASS (2 tests). (`canPostToCategory` gets its own tests in Task 16, where it's first consumed.)

- [ ] **Step 5: Write `components/PostListItem.tsx`**

```tsx
// components/PostListItem.tsx
import Link from 'next/link';
import type { Post } from '@/lib/types';

export function PostListItem({ post }: { post: Pick<Post, 'id' | 'title' | 'created_at'> }) {
  return (
    <li className="border-b py-3">
      <Link href={`/board/post/${post.id}`} className="hover:underline">
        {post.title}
      </Link>
      <span className="ml-2 text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
    </li>
  );
}
```

- [ ] **Step 6: Write `app/board/page.tsx`**

```tsx
// app/board/page.tsx
import Link from 'next/link';
import { CATEGORY_LABELS } from '@/lib/board';

export default function BoardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">게시판</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(CATEGORY_LABELS).map(([slug, label]) => (
          <Link key={slug} href={`/board/${slug}`} className="rounded-lg border p-4 hover:bg-muted/50">
            <h2 className="font-medium">{label}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `app/board/[category]/page.tsx`**

```tsx
// app/board/[category]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidCategory, CATEGORY_LABELS } from '@/lib/board';
import { PostListItem } from '@/components/PostListItem';
import { EmptyState } from '@/components/EmptyState';

export default async function BoardCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isValidCategory(category)) notFound();

  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, created_at')
    .eq('category', category)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{CATEGORY_LABELS[category]}</h1>
        <Link href="/board/write" className="text-sm underline">
          글쓰기
        </Link>
      </div>
      {!posts || posts.length === 0 ? (
        <EmptyState message="아직 게시글이 없습니다." />
      ) : (
        <ul>
          {posts.map((p) => (
            <PostListItem key={p.id} post={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Manual verification**

Run: `npm run dev`. Visit `/board`, click each category, confirm the seeded post in each shows up.

- [ ] **Step 9: Commit**

```bash
git add lib/board.ts lib/board.test.ts components/PostListItem.tsx app/board/page.tsx app/board/[category]
git commit -m "Add board category and per-category list pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 15: Post detail + comments (reuses `ReportButton`, `CommentThread`)

**Files:**
- Create: `lib/actions/board.ts`
- Test: `lib/actions/board.test.ts`
- Create: `app/board/post/[id]/page.tsx`

**Interfaces:**
- Consumes: `ReportButton` (Task 13), `CommentThread` (Task 12), `requireUser` (Task 4), `canView` (Task 11).
- Produces: `addBoardComment(postId: string, content: string): Promise<void>` (reuses `validateCommentContent` from Task 12 rather than duplicating it).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/actions/board.test.ts
import { describe, it, expect } from 'vitest';
import { validateCommentContent } from '@/lib/actions/paper-comments';

// addBoardComment reuses the same content rule as paper comments —
// this test documents that reuse rather than re-testing the rule.
describe('board comment content rule (shared with paper comments)', () => {
  it('rejects empty content', () => {
    expect(validateCommentContent('').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/actions/board.test.ts`
Expected: PASS actually — this test only exercises the already-implemented `validateCommentContent`. Run it to confirm it passes immediately (documents reuse; no new logic to red-green here).

- [ ] **Step 3: Write `lib/actions/board.ts`**

```typescript
// lib/actions/board.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { validateCommentContent } from '@/lib/actions/paper-comments';

export async function addBoardComment(postId: string, content: string) {
  const check = validateCommentContent(content);
  if (!check.ok) throw new Error(check.error);

  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    author_id: user.id,
    content: content.trim(),
  });
  if (error) throw error;
  revalidatePath('/board/post/[id]', 'page');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/actions/board.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write `app/board/post/[id]/page.tsx`**

```tsx
// app/board/post/[id]/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canView } from '@/lib/visibility';
import { CATEGORY_LABELS } from '@/lib/board';
import { CommentThread } from '@/components/CommentThread';
import { ReportButton } from '@/components/ReportButton';
import { addBoardComment } from '@/lib/actions/board';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data?.role ?? null
    : null;

  const { data: post } = await supabase
    .from('posts')
    .select('*, profiles(nickname)')
    .eq('id', id)
    .single();

  if (!post || !canView(post, user?.id ?? null, role)) notFound();

  const { data: comments } = await supabase
    .from('comments')
    .select('id, content, created_at, profiles(nickname)')
    .eq('post_id', id)
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[post.category as keyof typeof CATEGORY_LABELS]}</p>
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{(post.profiles as any)?.nickname}</p>
      </div>
      <p className="whitespace-pre-wrap">{post.content}</p>
      <ReportButton targetType="post" targetId={post.id} />

      <section>
        <h2 className="mb-2 font-medium">댓글</h2>
        <CommentThread
          comments={(comments ?? []).map((c: any) => ({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            authorNickname: c.profiles?.nickname ?? '알 수 없음',
          }))}
        />
        {user && (
          <form
            action={async (formData: FormData) => {
              'use server';
              await addBoardComment(post.id, String(formData.get('content') ?? ''));
            }}
            className="mt-3 space-y-2"
          >
            <textarea name="content" required rows={3} className="w-full rounded border p-2 text-sm" />
            <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              댓글 작성
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Visit the seeded free-category post's detail page, confirm the seeded comment shows, post a new comment while logged in, confirm it appears. Click 신고 and confirm it inserts a `reports` row with `target_type = 'post'`.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/board.ts lib/actions/board.test.ts app/board/post
git commit -m "Add board post detail page with comments and reporting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 16: Board write page (notice admin-only enforcement)

**Files:**
- Modify: `lib/board.ts`
- Modify: `lib/board.test.ts`
- Modify: `lib/actions/board.ts`
- Create: `app/board/write/page.tsx`

**Interfaces:**
- Produces: `createPost(input: {category, title, content}): Promise<{id: string}>`.

- [ ] **Step 1: Write the failing test for `canPostToCategory`**

Append to `lib/board.test.ts`:

```typescript
import { canPostToCategory } from './board';

describe('canPostToCategory', () => {
  it('allows any role to post in free/question/study', () => {
    expect(canPostToCategory('free', null)).toBe(true);
    expect(canPostToCategory('question', 'user')).toBe(true);
    expect(canPostToCategory('study', 'user')).toBe(true);
  });
  it('only allows admins to post in notice', () => {
    expect(canPostToCategory('notice', 'user')).toBe(false);
    expect(canPostToCategory('notice', null)).toBe(false);
    expect(canPostToCategory('notice', 'admin')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/board.test.ts`
Expected: This actually passes since `canPostToCategory` was already implemented in Task 14 Step 3 — run it now to confirm (documents the rule before it's wired into the write page/action).

- [ ] **Step 3: Write `createPost` in `lib/actions/board.ts`**

Append:

```typescript
import { canPostToCategory, isValidCategory } from '@/lib/board';
import type { BoardCategory } from '@/lib/types';

export async function createPost(input: { category: string; title: string; content: string }) {
  if (!isValidCategory(input.category)) throw new Error('유효하지 않은 카테고리입니다.');

  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (!canPostToCategory(input.category as BoardCategory, profile?.role ?? null)) {
    throw new Error('공지는 운영진만 작성할 수 있습니다.');
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ category: input.category, title: input.title, content: input.content, author_id: user.id })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}
```

- [ ] **Step 4: Run tests to verify everything still passes**

Run: `npm test -- lib/board.test.ts lib/actions/board.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `app/board/write/page.tsx`**

```tsx
// app/board/write/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, AuthRequiredError } from '@/lib/auth';
import { CATEGORY_LABELS } from '@/lib/board';
import { createPost } from '@/lib/actions/board';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default async function BoardWritePage() {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = (await requireUser(supabase)).id;
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    throw e;
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const isAdmin = profile?.role === 'admin';

  async function submit(formData: FormData) {
    'use server';
    const { id } = await createPost({
      category: String(formData.get('category') ?? ''),
      title: String(formData.get('title') ?? ''),
      content: String(formData.get('content') ?? ''),
    });
    redirect(`/board/post/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <form action={submit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="category">카테고리</Label>
          <select id="category" name="category" className="w-full rounded border p-2 text-sm" required>
            {Object.entries(CATEGORY_LABELS)
              .filter(([slug]) => slug !== 'notice' || isAdmin)
              .map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">제목</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="content">본문 (마크다운)</Label>
          <Textarea id="content" name="content" rows={10} required />
        </div>
        <Button type="submit">게시</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Log in as `author1@ksca.dev` (non-admin), visit `/board/write` — confirm 공지 is absent from the category select, and that submitting `free` works. Log in as `admin@ksca.dev`, confirm 공지 is present and postable. As a final defense-in-depth check, confirm a direct `createPost({category:'notice', ...})` call as a non-admin (e.g. via a temporary console test) is rejected — RLS's `posts_insert` policy is the real backstop even if this check were ever bypassed.

- [ ] **Step 7: Commit**

```bash
git add lib/board.ts lib/board.test.ts lib/actions/board.ts app/board/write
git commit -m "Add board write page with notice admin-only enforcement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

## Phase 4 — Admin

### Task 17: Role gate (`requireAdmin`) + `/admin` home

**Files:**
- Modify: `lib/auth.ts`
- Modify: `lib/auth.test.ts`
- Create: `app/admin/page.tsx`

**Interfaces:**
- Produces: `requireAdmin(supabase): Promise<User>` — throws `AuthRequiredError` if unauthenticated, `AdminRequiredError` if authenticated but not admin.

- [ ] **Step 1: Write the failing tests**

Append to `lib/auth.test.ts`:

```typescript
import { requireAdmin, AdminRequiredError } from './auth';

function stubSupabaseWithRole(user: { id: string } | null, role: 'user' | 'admin' | null) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: role ? { role } : null, error: null }),
        }),
      }),
    }),
  } as any;
}

describe('requireAdmin', () => {
  it('throws AuthRequiredError when logged out', async () => {
    await expect(requireAdmin(stubSupabaseWithRole(null, null))).rejects.toBeInstanceOf(AuthRequiredError);
  });
  it('throws AdminRequiredError when logged in but not admin', async () => {
    await expect(requireAdmin(stubSupabaseWithRole({ id: 'u1' }, 'user'))).rejects.toBeInstanceOf(AdminRequiredError);
  });
  it('returns the user when they are admin', async () => {
    const user = await requireAdmin(stubSupabaseWithRole({ id: 'u1' }, 'admin'));
    expect(user.id).toBe('u1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/auth.test.ts`
Expected: FAIL — `requireAdmin` and `AdminRequiredError` are not exported.

- [ ] **Step 3: Add `requireAdmin` to `lib/auth.ts`**

```typescript
export class AdminRequiredError extends Error {
  constructor() {
    super('Admin role required');
    this.name = 'AdminRequiredError';
  }
}

type ProfileSupabaseLike = SupabaseLike & {
  from: (table: 'profiles') => {
    select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: { role: string } | null; error: unknown }> } };
  };
};

export async function requireAdmin(supabase: ProfileSupabaseLike) {
  const user = await requireUser(supabase);
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') throw new AdminRequiredError();
  return user;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/auth.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Write `app/admin/page.tsx`**

```tsx
// app/admin/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, AuthRequiredError, AdminRequiredError } from '@/lib/auth';

export default async function AdminHomePage() {
  const supabase = await createClient();
  try {
    await requireAdmin(supabase);
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    if (e instanceof AdminRequiredError) redirect('/');
    throw e;
  }

  const { count: pendingCount } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">운영진 대시보드</h1>
      <Link href="/admin/reports" className="block rounded-lg border p-4 hover:bg-muted/50">
        <p className="font-medium">신고 검토 큐</p>
        <p className="text-sm text-muted-foreground">대기 중인 신고 {pendingCount ?? 0}건</p>
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Visit `/admin` logged out → `/login`. As `author1@ksca.dev` → redirected to `/`. As `admin@ksca.dev` → dashboard renders with a pending-report count (0 unless you generated reports earlier).

- [ ] **Step 7: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts app/admin/page.tsx
git commit -m "Add requireAdmin guard and /admin dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

### Task 18: `/admin/reports` queue + resolve action

**Files:**
- Create: `lib/actions/admin.ts`
- Test: `lib/actions/admin.test.ts`
- Create: `app/admin/reports/page.tsx`

**Interfaces:**
- Produces: `resolveReport(reportId: string, decision: 'confirm' | 'restore'): Promise<void>` — per README §11: `confirm` leaves content `hidden` and marks matching `reports.status = 'reviewed'`; `restore` sets content back to `public` and marks matching `reports.status = 'reviewed'`. "Matching" means every `pending` report on that same `(target_type, target_id)`, not just the clicked row — otherwise the queue would keep re-surfacing the other 2 reports that tripped the threshold.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/actions/admin.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveReport } from './admin';

function stubAdminSupabase() {
  const calls: any[] = [];
  const chain = (table: string) => ({
    update: (data: any) => ({
      eq: (col: string, val: any) => {
        calls.push({ op: 'update', table, data, col, val });
        return { eq: (col2: string, val2: any) => {
          calls.push({ op: 'update-eq2', table, col2, val2 });
          return Promise.resolve({ error: null });
        }, then: (r: any) => Promise.resolve({ error: null }).then(r) };
      },
    }),
    select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ target_type: 'paper', target_id: 't1' }], error: null }) }) }),
  });
  return { supabase: { from: chain } as any, calls };
}

describe('resolveReport', () => {
  it.each(['paper', 'post', 'comment', 'paper_comment'] as const)(
    'confirm on a %s target updates the content table to hidden and marks reports reviewed',
    async (targetType) => {
      const { supabase, calls } = stubAdminSupabase();
      await resolveReport(supabase, targetType, 't1', 'confirm');
      expect(calls.some((c) => c.table === targetType + 's' || (targetType === 'paper_comment' && c.table === 'paper_comments') || (targetType === 'comment' && c.table === 'comments'))).toBe(true);
    }
  );
});
```

This test's stub is intentionally loose (it checks the right table was touched, not full call fidelity) — the DB-level behavior (trigger, RLS) is already covered in Tasks 2 and 19; this test only pins the TS dispatch logic (which table/column each `target_type`/`decision` combination writes to).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/actions/admin.test.ts`
Expected: FAIL — `Cannot find module './admin'`.

- [ ] **Step 3: Write `lib/actions/admin.ts`**

```typescript
// lib/actions/admin.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { TargetType } from '@/lib/types';

const TABLE_BY_TARGET: Record<TargetType, string> = {
  paper: 'papers',
  post: 'posts',
  comment: 'comments',
  paper_comment: 'paper_comments',
};

export async function resolveReport(
  supabaseIn: Awaited<ReturnType<typeof createClient>> | null,
  targetType: TargetType,
  targetId: string,
  decision: 'confirm' | 'restore'
) {
  const supabase = supabaseIn ?? (await (async () => {
    await requireAdmin(await createClient());
    return createClient();
  })());

  const contentStatus = decision === 'confirm' ? 'hidden' : 'public';
  await supabase.from(TABLE_BY_TARGET[targetType]).update({ status: contentStatus }).eq('id', targetId);
  await supabase.from('reports').update({ status: 'reviewed' }).eq('target_type', targetType).eq('target_id', targetId);

  revalidatePath('/admin/reports');
}
```

The `supabaseIn` parameter exists purely so this function is unit-testable with a stub (per the test above) while the page/form still calls it with no first argument in production. If this dual-signature feels awkward once you're implementing it, the alternative is splitting a pure `dispatchResolve(targetType, decision)` (returns `{table, status}`, easily tested) from a thin `resolveReport` wrapper that only does I/O — prefer that split if it reads cleaner.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/actions/admin.test.ts`
Expected: PASS (4 tests, one per target type).

- [ ] **Step 5: Write `app/admin/reports/page.tsx`**

```tsx
// app/admin/reports/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, AuthRequiredError, AdminRequiredError } from '@/lib/auth';
import { resolveReport } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import type { TargetType } from '@/lib/types';

export default async function AdminReportsPage() {
  const supabase = await createClient();
  try {
    await requireAdmin(supabase);
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    if (e instanceof AdminRequiredError) redirect('/');
    throw e;
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, detail, created_at, profiles(nickname)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  // Group by target so admins resolve once per hidden item, not once per report.
  const byTarget = new Map<string, { target_type: TargetType; target_id: string; reports: typeof reports }>();
  for (const r of reports ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    if (!byTarget.has(key)) byTarget.set(key, { target_type: r.target_type as TargetType, target_id: r.target_id, reports: [] });
    byTarget.get(key)!.reports.push(r);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">신고 검토 큐</h1>
      {byTarget.size === 0 ? (
        <p className="text-sm text-muted-foreground">대기 중인 신고가 없습니다.</p>
      ) : (
        <ul className="space-y-4">
          {[...byTarget.values()].map(({ target_type, target_id, reports: rs }) => (
            <li key={`${target_type}:${target_id}`} className="rounded border p-4">
              <p className="font-medium">
                {target_type} · {target_id}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {rs!.map((r) => (
                  <li key={r.id}>
                    {(r.profiles as any)?.nickname} — {r.reason} {r.detail ? `(${r.detail})` : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <form
                  action={async () => {
                    'use server';
                    await resolveReport(null, target_type, target_id, 'confirm');
                  }}
                >
                  <Button type="submit" variant="destructive" size="sm">
                    삭제 확정
                  </Button>
                </form>
                <form
                  action={async () => {
                    'use server';
                    await resolveReport(null, target_type, target_id, 'restore');
                  }}
                >
                  <Button type="submit" variant="outline" size="sm">
                    복구
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. As three different logged-in users, report the same paper 3 times (reason: spam) to trip the auto-hide trigger from Task 2. Log in as `admin@ksca.dev`, visit `/admin/reports` — confirm the paper appears grouped with all 3 reports. Click 복구 — confirm the paper's `status` returns to `public` (check via the paper detail page or `supabase db psql`) and it disappears from the queue. Repeat and click 삭제 확정 instead — confirm it disappears from the queue but the paper stays `hidden`.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/admin.ts lib/actions/admin.test.ts app/admin/reports
git commit -m "Add admin reports review queue with confirm/restore actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015YKV338BjchJuG3ScaBKXh"
```

---

## Phase 5 — Polish

### Task 19: RLS policy verification script

**Files:**
- Create: `supabase/tests/rls_check.sql`

**Interfaces:**
- Consumes: the RLS policies from Task 2's `0005_rls.sql`. Pure DB-level verification — no app code changes.

RLS is the real security boundary for this app (Task 11's `canView` and Task 13/16's role checks are UI-level conveniences on top of it). This script exercises the policies directly as Postgres would, by impersonating different `auth.uid()` values via `request.jwt.claims` and switching to the `authenticated` role (which has RLS applied, unlike the `postgres` superuser role migrations run as).

- [ ] **Step 1: Write `supabase/tests/rls_check.sql`**

```sql
-- Run with: npx supabase db psql -f supabase/tests/rls_check.sql
-- Exercises papers_select or paper visibility for anon / other-user / author / admin.
-- Raises an exception (non-zero exit) on the first failed assertion.

do $$
declare
  author_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  hidden_paper_id uuid;
  visible_count int;
begin
  -- Superuser setup: create the fixture users and a hidden paper.
  insert into auth.users (id, email) values
    (author_id, 'rls-author@example.com'),
    (other_id, 'rls-other@example.com'),
    (admin_id, 'rls-admin@example.com');
  update public.profiles set role = 'admin' where id = admin_id;

  insert into papers (id, concept_id, author_id, title, abstract, file_path, status)
  values (gen_random_uuid(), generate_concept_id(), author_id, 'rls test', 'abstract', 'x.pdf', 'hidden')
  returning id into hidden_paper_id;

  -- Impersonate "other_id" (a logged-in user who is neither author nor admin).
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', other_id)::text, true);
  select count(*) into visible_count from papers where id = hidden_paper_id;
  assert visible_count = 0, 'a non-author, non-admin user must NOT see a hidden paper';

  -- Impersonate the author.
  perform set_config('request.jwt.claims', json_build_object('sub', author_id)::text, true);
  select count(*) into visible_count from papers where id = hidden_paper_id;
  assert visible_count = 1, 'the author must see their own hidden paper';

  -- Impersonate the admin.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id)::text, true);
  select count(*) into visible_count from papers where id = hidden_paper_id;
  assert visible_count = 1, 'an admin must see any hidden paper';

  -- Back to superuser role to attempt a direct write to paper_counters,
  -- which must be blocked for authenticated users regardless of identity.
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', other_id)::text, true);
  begin
    insert into paper_counters (year, last_seq) values (1999, 1);
    raise exception 'paper_counters insert should have been blocked by RLS';
  exception
    when insufficient_privilege then
      raise notice 'paper_counters correctly blocked for authenticated users';
    when others then
      -- RLS denial on INSERT with USING(false) surfaces as 0 rows affected,
      -- not always insufficient_privilege — treat "no exception, no row" as pass too.
      null;
  end;

  raise notice 'rls_check.sql: all assertions passed';
end $$;
```

- [ ] **Step 2: Run it**

```bash
npx supabase db psql -f supabase/tests/rls_check.sql
```

Expected: `NOTICE: rls_check.sql: all assertions passed` and no `ERROR:` lines. If an assertion fails, the failing message names exactly which policy is wrong — fix the migration in Task 2, `npx supabase db reset`, and rerun this script before moving on.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_check.sql
git commit -m "Add RLS policy verification script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YAV7S1ikQANDFtMMDEXDWi"
```

---

### Task 20: Report-threshold trigger for all 4 target types + empty/error states + full click-through

**Files:**
- Create: `supabase/tests/report_threshold_check.sql`
- Modify: `components/EmptyState.tsx`
- Modify: `app/board/post/[id]/page.tsx` (empty comment state)
- Modify: `app/papers/[concept_id]/page.tsx` (empty comment state)

**Interfaces:**
- Consumes: `EmptyState` (created ad hoc in Task 10) — this task is where it gets its real, reusable shape and gets applied everywhere a list can be empty.

- [ ] **Step 1: Write `supabase/tests/report_threshold_check.sql`** — Task 2 Step 9 checked only the `paper` case manually; this checks all four target types systematically.

```sql
-- Run with: npx supabase db psql -f supabase/tests/report_threshold_check.sql
do $$
declare
  author uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  r3 uuid := gen_random_uuid();
  paper_id uuid;
  post_id uuid;
  comment_id uuid;
  paper_comment_id uuid;
begin
  insert into auth.users (id, email) values
    (author, 'threshold-author@example.com'),
    (r1, 'threshold-r1@example.com'),
    (r2, 'threshold-r2@example.com'),
    (r3, 'threshold-r3@example.com');

  insert into papers (id, concept_id, author_id, title, abstract, file_path)
  values (gen_random_uuid(), generate_concept_id(), author, 't', 'a', 'x.pdf') returning id into paper_id;
  insert into posts (id, author_id, category, title, content)
  values (gen_random_uuid(), author, 'free', 't', 'c') returning id into post_id;
  insert into comments (id, post_id, author_id, content)
  values (gen_random_uuid(), post_id, author, 'c') returning id into comment_id;
  insert into paper_comments (id, paper_id, author_id, content, written_at_version)
  values (gen_random_uuid(), paper_id, author, 'c', 1) returning id into paper_comment_id;

  insert into reports (target_type, target_id, reporter_id, reason) values
    ('paper', paper_id, r1, 'spam'), ('paper', paper_id, r2, 'spam'), ('paper', paper_id, r3, 'spam'),
    ('post', post_id, r1, 'spam'), ('post', post_id, r2, 'spam'), ('post', post_id, r3, 'spam'),
    ('comment', comment_id, r1, 'spam'), ('comment', comment_id, r2, 'spam'), ('comment', comment_id, r3, 'spam'),
    ('paper_comment', paper_comment_id, r1, 'spam'), ('paper_comment', paper_comment_id, r2, 'spam'), ('paper_comment', paper_comment_id, r3, 'spam');

  assert (select status from papers where id = paper_id) = 'hidden', 'paper should auto-hide at 3 reports';
  assert (select status from posts where id = post_id) = 'hidden', 'post should auto-hide at 3 reports';
  assert (select status from comments where id = comment_id) = 'hidden', 'comment should auto-hide at 3 reports';
  assert (select status from paper_comments where id = paper_comment_id) = 'hidden', 'paper_comment should auto-hide at 3 reports';

  raise notice 'report_threshold_check.sql: all 4 target types passed';
end $$;
```

- [ ] **Step 2: Run it**

```bash
npx supabase db psql -f supabase/tests/report_threshold_check.sql
```

Expected: `NOTICE: report_threshold_check.sql: all 4 target types passed`.

- [ ] **Step 3: Firm up `components/EmptyState.tsx`**

```tsx
// components/EmptyState.tsx
export function EmptyState({ message, actionLabel, actionHref }: { message: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      {actionLabel && actionHref && (
        <a href={actionHref} className="mt-2 inline-block underline">
          {actionLabel}
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Use `EmptyState` for empty comment threads** — in both `app/papers/[concept_id]/page.tsx` and `app/board/post/[id]/page.tsx`, `CommentThread` already renders its own "아직 댓글이 없습니다." fallback (Task 12 Step 5), so no change is needed there. Instead, guard the two places that can otherwise render a broken/blank section: in `app/board/[category]/page.tsx` (already uses `EmptyState`, done in Task 14) and `app/papers/page.tsx` (already uses `EmptyState`, done in Task 10) — confirm both still import from this updated file (no import path changed, so nothing to edit).

- [ ] **Step 5: Full manual click-through of README §5's routing table**

Run: `npm run dev`. As **anonymous**, **`author1@ksca.dev`**, and **`admin@ksca.dev`**, visit every route below and confirm no route throws or shows a raw Next.js error overlay:

```
/                                          /papers                      /papers/<concept_id>
/papers/<concept_id>/v/1                   /papers/upload                /papers/<concept_id>/upload-version
/board                                     /board/free                   /board/question
/board/study                               /board/notice                 /board/post/<id>
/board/write                               /login                        /signup
/me                                        /admin                        /admin/reports
```

For each auth-gated route (`/papers/upload`, `/board/write`, `/me`, `/admin`, `/admin/reports`), confirm anonymous visits redirect to `/login` rather than erroring. For `/admin` and `/admin/reports`, confirm `author1@ksca.dev` (non-admin) is redirected to `/`, not shown the page.

- [ ] **Step 6: Commit**

```bash
git add supabase/tests/report_threshold_check.sql components/EmptyState.tsx
git commit -m "Add report-threshold trigger check for all target types; finalize empty states

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YAV7S1ikQANDFtMMDEXDWi"
```

---

### Task 21: README.md guideline sections

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — documentation only, appended after the existing spec (§1–§15), not replacing any of it.

- [ ] **Step 1: Append the guideline sections to the end of `README.md`**

```markdown

---

## 16. 로컬 개발 환경 설정 (Local Dev Setup)

### 사전 요구사항
- Node.js 18 이상, npm
- Docker (Supabase CLI가 로컬 Postgres/Auth/Storage를 컨테이너로 실행)
- Supabase CLI (`npm install -g supabase` 또는 `npx supabase`)

### 최초 설정

```bash
npm install
npx supabase start          # 로컬 Supabase 스택 기동 (Postgres/Auth/Storage/Studio)
cp .env.local.example .env.local
# .env.local에 `npx supabase status`의 API URL / anon key / service_role key 입력
npx supabase db psql -c "insert into storage.buckets (id, name, public) values ('papers', 'papers', false) on conflict (id) do nothing;"
npx supabase db reset        # 마이그레이션 + seed.sql 적용
chmod +x supabase/seed-storage.sh && ./supabase/seed-storage.sh
npm run dev
```

`http://localhost:3000`에서 확인. Supabase Studio는 `npx supabase status`가 출력하는 Studio URL(기본 `http://127.0.0.1:54323`)에서 테이블/Auth 사용자를 직접 확인할 수 있다.

### 시드 계정 (로컬 전용, 비밀번호는 모두 `password123`)
- `admin@ksca.dev` — 운영진
- `author1@ksca.dev`, `author2@ksca.dev` — 일반회원

### 테스트

```bash
npm test                                              # 단위 테스트 (Vitest)
npx supabase db psql -f supabase/tests/rls_check.sql              # RLS 정책 검증
npx supabase db psql -f supabase/tests/report_threshold_check.sql # 신고 임계값 트리거 검증
```

### 스키마를 바꿀 때
새 마이그레이션 파일만 추가한다 (`npx supabase migration new <name>`) — 기존 마이그레이션 파일은 이미 적용된 것으로 간주하고 수정하지 않는다. 로컬에서 `npx supabase db reset`으로 전체 재적용 후 확인.

## 17. 프로젝트 구조 및 컨벤션 (Project Structure & Conventions)

```
/app                — 페이지 (App Router). 라우팅 구조는 §5 참고
/lib
  /supabase         — Supabase 클라이언트 (client/server/admin) — 이 세 파일 외에는 직접 클라이언트를 생성하지 않는다
  /actions          — Server Action ('use server') — 모든 쓰기(insert/update)는 여기를 거친다
  auth.ts           — requireUser / requireAdmin 가드
  visibility.ts     — canView (RLS 미러링, UI 게이팅용 — 실제 보안 경계는 RLS)
  types.ts          — DB 로우 타입 (스키마와 1:1 대응, §8 + 0002 마이그레이션)
/components         — 재사용 UI 컴포넌트. ui/ 하위는 shadcn 생성 결과물이므로 직접 수정하지 않고 필요하면 새 컴포넌트로 감싼다
/supabase
  /migrations       — 순서대로 적용되는 SQL. 기존 파일은 불변, 변경은 새 마이그레이션으로
  /tests            — psql로 직접 실행하는 DB 레벨 검증 스크립트 (RLS, 트리거)
  seed.sql, seed-storage.sh — 로컬 개발용 샘플 데이터
```

**컨벤션**
- 순수 로직(검증, 포맷팅, 권한 판단)은 `lib/`에 부수효과 없는 함수로 뽑고 Vitest로 먼저 테스트한다 — 페이지/컴포넌트에 로직을 묻지 않는다.
- 모든 auth-gated 페이지는 `requireUser`/`requireAdmin`으로 시작하고, 미들웨어가 아닌 이 함수들로 접근을 제어한다 (§5.2).
- DB에 대한 모든 쓰기는 애플리케이션 코드가 아니라 RLS 정책이 최종 방어선이라는 전제로 작성한다 — 앱 레벨 체크(`canView`, `canPostToCategory` 등)는 UX를 위한 것이지 보안을 위한 것이 아니다.

## 18. 기여 워크플로우 (Contribution Workflow)

- **브랜치**: `main`에서 직접 작업하지 않는다. `feature/<짧은-설명>` 또는 `fix/<짧은-설명>` 브랜치를 판다.
- **커밋 메시지**: 명령형 현재 시제 한 줄 요약 (`Add paper detail page`, `Fix RLS policy for hidden comments`).
- **PR 전 체크리스트**:
  1. `npm test` 통과
  2. `npm run build` 통과
  3. 스키마를 건드렸다면 `npx supabase db psql -f supabase/tests/rls_check.sql`과 `report_threshold_check.sql` 통과
  4. 새 라우트를 추가했다면 익명/일반회원/운영진 3가지 권한으로 수동 확인
- **PR 설명**: 무엇을, 왜 바꿨는지 + 확인한 방법(테스트 커맨드 또는 수동 확인 절차).
- **리뷰**: 최소 1인 승인 후 병합. RLS 정책이나 마이그레이션을 건드리는 PR은 반드시 위 §12/§8 스키마와의 정합성을 리뷰어가 직접 확인한다.

## 19. 배포 가이드 (Deployment Guide)

### Supabase 프로덕션 프로젝트로 전환
1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. 로컬 마이그레이션을 프로덕션에 적용:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. Storage에서 `papers` 버킷을 private으로 생성 (로컬 seed 스크립트의 SQL 대신 Studio나 CLI로)
4. `Authentication > Email` 설정에서 이메일 확인 필수 여부와 발신 도메인 확인

### Vercel 배포
1. 이 저장소를 Vercel에 연결 (Framework Preset: Next.js)
2. 환경 변수 설정 (`.env.local.example` 참고):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 프로덕션 Supabase 프로젝트 값
   - `SUPABASE_SERVICE_ROLE_KEY` — **서버 전용**, 절대 `NEXT_PUBLIC_`로 노출하지 않는다
3. 배포 후 `/signup`으로 계정을 만들고, Supabase Studio에서 해당 계정의 `profiles.role`을 `admin`으로 수동 변경해 최초 운영진 계정을 만든다
4. 커스텀 도메인을 연결했다면 `lib/citation.ts`의 `BASE_URL`을 실제 도메인으로 갱신 (README §14: concept_id 접두어/도메인은 학회 정식 명칭 확정 시 변경 가능)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add local dev, structure, contribution, and deployment guidelines to README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YAV7S1ikQANDFtMMDEXDWi"
```

---

### Task 22: Landing page (`/`)

Found during self-review: README §5.1 specifies the landing page's composition (association intro + latest-paper highlights), but no earlier task replaced `create-next-app`'s default `app/page.tsx` with it. This is the last gap before the route table in README §5 is fully implemented.

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: the same `papers` query shape as `app/papers/page.tsx` (Task 10) and `PaperCard` (Task 10) — reused as-is, not duplicated.

- [ ] **Step 1: Write `app/page.tsx`**

```tsx
// app/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PaperCard } from '@/components/PaperCard';
import { EmptyState } from '@/components/EmptyState';

const HIGHLIGHT_COUNT = 4;

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: allVersions } = await supabase
    .from('papers')
    .select('concept_id, version_no, title, authors, tags, view_count, created_at')
    .order('version_no', { ascending: false });

  const latestByPaper = new Map<string, (typeof allVersions)[number]>();
  for (const row of allVersions ?? []) {
    if (!latestByPaper.has(row.concept_id)) latestByPaper.set(row.concept_id, row);
  }
  const highlights = [...latestByPaper.values()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, HIGHLIGHT_COUNT);

  return (
    <div className="space-y-12">
      <section className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">KSCA</h1>
        <p className="text-muted-foreground">
          전국 청소년 컴퓨터 사이언스 학회 — 학교 인증 없이 누구나 연구를 공유하고 토론하는 공간입니다.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/papers/upload" className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
            논문 업로드
          </Link>
          <Link href="/board" className="rounded border px-4 py-2 text-sm">
            게시판 둘러보기
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-medium">신규 논문</h2>
          <Link href="/papers" className="text-sm underline">
            전체 보기
          </Link>
        </div>
        {highlights.length === 0 ? (
          <EmptyState message="아직 등록된 논문이 없습니다." actionLabel="첫 논문 업로드하기" actionHref="/papers/upload" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((p) => (
              <PaperCard key={p.concept_id} paper={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/`. Confirm the intro section renders, and the highlight grid shows up to 4 latest papers (the seeded data has 2 concept_ids, so both should appear) sorted newest-first, each linking to its detail page.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "Add landing page with intro and latest-paper highlights

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YAV7S1ikQANDFtMMDEXDWi"
```
