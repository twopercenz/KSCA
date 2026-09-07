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
