// components/CommentThread.tsx
import { VersionBadge } from '@/components/VersionBadge';

export type ThreadComment = {
  id: string;
  content: string;
  created_at: string;
  authorNickname: string;
  version?: number;
};

export function CommentThread({ comments }: { comments: ThreadComment[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>;
  }
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="rounded border p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{c.authorNickname}</span>
            {c.version !== undefined && <VersionBadge version={c.version} />}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleString('ko-KR')}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{c.content}</p>
        </li>
      ))}
    </ul>
  );
}
