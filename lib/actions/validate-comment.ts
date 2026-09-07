// lib/actions/validate-comment.ts
// Pure validation helper, kept out of `paper-comments.ts` because a
// `'use server'` module may only export async Server Actions (Next.js 16
// enforces this at build time) — this file carries no directive so it stays
// a plain sync export. See auth-parse.ts and validate-upload.ts for the same
// pattern.

export function validateCommentContent(content: string): { ok: true } | { ok: false; error: string } {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { ok: false, error: '댓글 내용을 입력해주세요.' };
  if (trimmed.length > 2000) return { ok: false, error: '댓글은 2000자를 넘을 수 없습니다.' };
  return { ok: true };
}
