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
