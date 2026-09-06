create policy "comments_update_admin_only" on comments for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "paper_comments_update_admin_only" on paper_comments for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
