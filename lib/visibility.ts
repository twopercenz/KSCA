// lib/visibility.ts
// Mirrors the `papers_select` / `posts_select` / `comments_select` /
// `paper_comments_select` RLS policies (README §12) for UI-level gating.
// RLS is the actual security boundary; this only decides what to render.

type ViewableContent = { status: 'public' | 'hidden'; author_id: string };

export function canView(content: ViewableContent, viewerId: string | null, viewerRole: 'user' | 'admin' | null): boolean {
  if (content.status === 'public') return true;
  if (viewerId && content.author_id === viewerId) return true;
  if (viewerRole === 'admin') return true;
  return false;
}
