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
  const latestByPaper = new Map<string, NonNullable<typeof allVersions>[number]>();
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
