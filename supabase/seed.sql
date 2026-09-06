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
