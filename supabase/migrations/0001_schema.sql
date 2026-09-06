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
