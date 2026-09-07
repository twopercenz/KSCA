// app/papers/[concept_id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canView } from '@/lib/visibility';
import { CitationBlock } from '@/components/CitationBlock';
import { VersionBadge } from '@/components/VersionBadge';
import { CommentThread } from '@/components/CommentThread';
import { addPaperComment, getPaperComments } from '@/lib/actions/paper-comments';

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

  // Service-role client: a plain visitor is neither the author nor an admin,
  // so this would be blocked by papers_update_own_or_admin on the regular
  // session client (see the pre-flight note above).
  await createAdminClient()
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
    </div>
  );
}
