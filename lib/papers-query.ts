// lib/papers-query.ts
export type PaperListParams = { sort: 'latest' | 'views'; tag: string | null };

export function parsePaperListParams(searchParams: Record<string, string | undefined>): PaperListParams {
  const sort = searchParams.sort === 'views' ? 'views' : 'latest';
  const tag = searchParams.tag ?? null;
  return { sort, tag };
}
