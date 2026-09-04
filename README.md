# KSCA (전국 청소년 컴퓨터 사이언스 학회) 웹 서비스 기능 명세서

버전: v1.0
문서 성격: 논문 아카이브 + 커뮤니티 웹 서비스 기능/DB/보안 명세

---

## 1. 서비스 개요

- **명칭**: KSCA (Korea Student Computer science Association) — 가칭
- **대상**: 전국 청소년 (학교 인증 없음, 자율 입력)
- **범위**: 전국 단위
- **핵심 기능**
  1. 논문/프로젝트 아카이브 (Zenodo식 업로드·인용·버전관리)
  2. 커뮤니티 게시판 (게시글 + 댓글)
  3. 신고 기반 콘텐츠 관리 (운영진 사전승인 없음)

---

## 2. 사용자 및 권한

| 구분 | 권한 |
|---|---|
| 비회원 | 아카이브/게시판 열람만 가능 |
| 일반회원 | 업로드, 글쓰기, 댓글, 신고 가능 |
| 운영진(Admin) | 신고 처리, 콘텐츠 강제 삭제/복구, 공지 작성 |

- 인증 방식: 이메일 + 비밀번호 (Supabase Auth), 이메일 인증 필수
- 학교 인증: 없음 — 자율 입력 텍스트 필드
- 소셜 로그인: v1.0 범위 제외

---

## 3. 논문 아카이브

### 3.1 업로드
- 필드: 제목, 저자명(본인 + 공동저자 텍스트 입력), 초록, 분야 태그, 학교명(자율 입력, nullable), PDF 파일, 버전(v1부터 시작)
- 운영진 사전승인 없음 → 업로드 즉시 게시
- 파일 형식: PDF만 허용, 용량 제한 20MB

### 3.2 Zenodo식 요소
- **영구 식별자(concept_id)**: `KSCA-{YYYY}-{NNNNNN}` 형식, 연도별 6자리 일련번호, 학회 전체 통합 카운터로 발급
  - 논문 하나(concept) 당 식별자 1개, 버전이 올라가도 concept_id는 유지되고 `version_no`만 증가
- **인용 포맷**: 상세 페이지에서 APA / BibTeX 둘 다 자동 생성 및 복사 제공
- **버전 관리**: 같은 논문의 새 버전 업로드 가능, 이전 버전은 "구버전"으로 표시되어 계속 열람 가능

### 3.3 열람
- 목록: 최신순 / 조회수순 / 태그 필터
- 상세 페이지 구성: 초록, PDF 뷰어/다운로드, 조회수, 인용 포맷(APA/BibTeX), 버전 히스토리, 댓글창, 신고 버튼

### 3.4 초록 댓글 (paper_comments)
- 논문 상세 페이지에 댓글 기능 존재
- 새 버전이 업로드되어도 **이전 버전 댓글은 유지**
- 댓글 조회 시 concept_id 기준으로 전체 버전의 댓글을 모아 보여주되, 각 댓글에 "v1에 작성됨" 등 **작성 시점 버전 배지** 표시

### 3.5 신고제
- 사전 승인 없음, 신고 기반 사후 관리
- 신고 사유: 표절 의심 / 부적절한 내용 / 스팸 / 기타(자유 텍스트)
- **동일 대상 신고 3건 누적** → 자동 비공개(`status = hidden`) + 운영진 검토 큐 이동
- 운영진이 최종 삭제 확정 또는 복구 결정

---

## 4. 커뮤니티 게시판

- 카테고리: 자유 / 질문 / 스터디·프로젝트 모집 / 공지(운영진 전용 작성)
- 게시글: 제목 + 본문(마크다운) + 태그
- 댓글: 1단계만 (대댓글 없음, v1.0 기준)
- 신고 로직: 아카이브와 동일 (3건 누적 시 자동 숨김)

---

## 5. 페이지 라우팅 구조

```
/                                    — 랜딩 (학회 소개 + 신규 논문 하이라이트)
/papers                              — 아카이브 목록 (태그 필터, 정렬)
/papers/[concept_id]                 — 논문 상세 (최신 버전, 버전 히스토리, 댓글, 인용, 신고)
/papers/[concept_id]/v/[n]           — 특정 버전 열람
/papers/upload                       — 신규 업로드 (로그인 필요)
/papers/[concept_id]/upload-version  — 새 버전 업로드 (원저자만)

/board                               — 게시판 카테고리 목록
/board/[category]                    — 카테고리별 글 목록
/board/post/[id]                     — 글 상세 + 댓글
/board/write                         — 글쓰기 (로그인 필요)

/login
/signup
/me                                  — 마이페이지 (내 논문, 내 글, 내 신고 내역)

/admin                               — 운영진 전용 (계정 role 기반 접근 제어)
/admin/reports                       — 신고 검토 큐 (삭제 확정 / 복구)
```

### 5.1 랜딩 페이지 구성
- 상단: 학회 소개
- 중단: 신규 논문 하이라이트 (최신 업로드 N건, 카드형)

### 5.2 Admin 접근 제어
- 라우트 미들웨어가 아닌 **계정의 role 값**으로 제어
- `/admin` 진입 시 `profiles.role === 'admin'` 확인 후 미인가 시 리다이렉트
- API/RLS 정책 단에서도 role 체크 (이중 방어)

---

## 6. 기술 스택

- Frontend: Next.js (App Router)
- Backend/DB: Supabase (Postgres + Auth + Storage)
- 파일 저장: Supabase Storage (PDF, private 버킷 + Signed URL)
- 배포: Vercel

---

## 7. 파일 업로드 — Signed URL 방식

- Storage 버킷 `papers`는 **private**로 생성
- **업로드**: 클라이언트 → 서버(Server Action/Edge Function)에 요청 → 서버가 `createSignedUploadUrl` 발급 → 클라이언트가 해당 URL로 직접 업로드
- **열람**: 요청 시마다 서버가 `createSignedUrl`(짧은 만료시간, 예: 5분) 발급 후 접근
- `papers.file_path` 컬럼에는 실제 URL이 아닌 **버킷 내 경로만 저장**, 매 요청마다 signed URL을 새로 생성

라우트 예시:
```
GET /api/papers/[id]/download  → 서버에서 signed URL 생성 후 반환/리다이렉트
```

---

## 8. DB 스키마 (최종본)

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

---

## 9. concept_id 발급 함수 (DB 함수, 원자적 증가)

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
```

- `on conflict ... do update`가 row-level lock으로 동시성 안전성 보장
- `security definer`로 정의하여 `paper_counters`에 직접 접근 권한이 없는 일반 유저도 함수를 통해서만 안전하게 발급 가능

---

## 10. 신고 3건 자동 숨김 트리거

```sql
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

---

## 11. 신고 검토(Review) 처리 로직

- **삭제 확정**: 콘텐츠 `status = hidden` 유지, 해당 `reports.status → reviewed`
- **복구**: 콘텐츠 `status → public`으로 복원, 해당 `reports.status → reviewed`
- `reports.status`(`pending`/`reviewed`)는 처리 여부만 표시
- 콘텐츠 자체의 `status`(`public`/`hidden`)가 실제 공개 여부의 source of truth
- `/admin/reports` 페이지에 "삭제 확정" / "복구" 버튼 두 개로 구성

---

## 12. RLS(Row Level Security) 정책

```sql
-- 모든 테이블 RLS 활성화
alter table profiles enable row level security;
alter table papers enable row level security;
alter table paper_comments enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table reports enable row level security;
alter table paper_counters enable row level security;

-- profiles: 전체 열람 가능, 본인만 수정
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- papers: public만 열람(작성자 본인+admin은 hidden도 열람), 로그인 유저만 작성, 작성자/admin만 수정
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

-- paper_comments: papers와 동일 패턴
create policy "paper_comments_select" on paper_comments for select
  using (
    status = 'public'
    or author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "paper_comments_insert" on paper_comments for insert
  with check (auth.uid() is not null and author_id = auth.uid());

-- posts: notice 카테고리는 admin만 작성 가능
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

-- comments: posts와 동일 패턴
create policy "comments_select" on comments for select
  using (
    status = 'public'
    or author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "comments_insert" on comments for insert
  with check (auth.uid() is not null and author_id = auth.uid());

-- reports: 본인 신고만 열람(admin은 전체), 로그인 유저 누구나 작성, admin만 처리
create policy "reports_select_own_or_admin" on reports for select
  using (
    reporter_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "reports_insert" on reports for insert
  with check (auth.uid() is not null and reporter_id = auth.uid());
create policy "reports_update_admin_only" on reports for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- paper_counters: 직접 접근 차단, generate_concept_id() 함수(security definer)를 통해서만 접근
create policy "paper_counters_no_direct_access" on paper_counters for all using (false);
```

---

## 13. 확정 사항 요약

| 항목 | 결정 |
|---|---|
| 논문 식별자 | `KSCA-{YYYY}-{NNNNNN}`, DB 함수로 원자적 발급 |
| 버전 관리 | concept_id 유지 + version_no 증가, 이전 버전 열람 가능 |
| 인용 포맷 | APA + BibTeX 둘 다 지원 |
| 초록 댓글 | 버전 유지, 작성 시점 버전 배지 표시 |
| 업로드 승인 | 없음 (즉시 게시) |
| 신고 기준 | 3건 누적 시 자동 숨김 (paper/post/comment/paper_comment 전체 적용) |
| 신고 최종 처리 | 운영진이 삭제 확정 또는 복구 |
| 학교 인증 | 없음, 자율 입력 |
| 파일 저장 | Signed URL 방식, private 버킷 |
| Admin 접근 제어 | 계정 role 기반 (미들웨어 아님) + RLS 이중 방어 |
| 기술 스택 | Next.js + Supabase + Vercel |

---

## 14. 미결정 사항 (다음 논의 필요)

1. 게시판 공지(notice) 외 카테고리 확장 여부
2. 마이페이지(`/me`)에서 신고 내역/처리 결과를 어느 수준까지 노출할지
3. concept_id 접두어(`KSCA`)는 학회 정식 명칭 확정 시 변경 가능성 있음
4. 실제 DOI 등록기관(예: DataCite) 가입 여부 — 지금은 자체 식별자만 발급, 추후 전환 가능하게 설계됨

---

## 15. 다음 단계 (선택)

1. Next.js 프로젝트 초기 세팅 + Supabase 클라이언트 연결
2. 페이지별 UI 와이어프레임
3. 업로드 플로우 실제 구현 (Signed URL 발급 서버 액션부터)
