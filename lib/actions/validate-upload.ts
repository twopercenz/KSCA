// lib/actions/validate-upload.ts
// Pure validation helper, kept out of `papers.ts` because a `'use server'`
// module may only export async Server Actions (Next.js 16 enforces this at
// build time once the module is imported by a Client Component) — this file
// carries no directive so it stays a plain sync export. See auth-parse.ts
// for the same pattern.

const MAX_BYTES = 20 * 1024 * 1024;

export function validateUploadRequest(input: { fileName: string; fileSize: number; fileType: string }):
  | { ok: true }
  | { ok: false; error: string } {
  if (input.fileType !== 'application/pdf' && !input.fileName.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'PDF 파일만 업로드할 수 있습니다.' };
  }
  if (input.fileSize > MAX_BYTES) {
    return { ok: false, error: '파일 크기는 20MB를 초과할 수 없습니다.' };
  }
  return { ok: true };
}
