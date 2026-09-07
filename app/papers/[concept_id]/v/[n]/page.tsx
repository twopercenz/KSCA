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
