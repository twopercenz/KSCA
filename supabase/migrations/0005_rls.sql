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
