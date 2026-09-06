// lib/actions/papers.ts
'use server';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

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

export async function requestPaperUpload(fileName: string, fileSize: number, fileType: string) {
  const supabase = await createClient();
  await requireUser(supabase); // throws if unauthenticated

  const check = validateUploadRequest({ fileName, fileSize, fileType });
  if (!check.ok) throw new Error(check.error);

  const path = `${randomUUID()}.pdf`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('papers').createSignedUploadUrl(path);
  if (error) throw error;

  return { path, signedUrl: data.signedUrl, token: data.token };
}

export type CreatePaperInput = {
  title: string;
  authors: string;
  abstract: string;
  tags: string[];
  school: string | null;
  filePath: string;
  existingConceptId?: string;
};

export async function createPaper(input: CreatePaperInput): Promise<{ concept_id: string }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  let conceptId = input.existingConceptId;
  let versionNo = 1;

  if (conceptId) {
    // New version of an existing paper — author-only, enforced here and by RLS.
    const { data: latest, error: latestErr } = await supabase
      .from('papers')
      .select('version_no, author_id')
      .eq('concept_id', conceptId)
      .order('version_no', { ascending: false })
      .limit(1)
      .single();
    if (latestErr) throw latestErr;
    if (latest.author_id !== user.id) throw new Error('원저자만 새 버전을 업로드할 수 있습니다.');
    versionNo = latest.version_no + 1;
  } else {
    const { data, error } = await supabase.rpc('generate_concept_id');
    if (error) throw error;
    conceptId = data as string;
  }

  const { error: insertErr } = await supabase.from('papers').insert({
    concept_id: conceptId,
    version_no: versionNo,
    author_id: user.id,
    authors: input.authors,
    title: input.title,
    abstract: input.abstract,
    tags: input.tags,
    school: input.school,
    file_path: input.filePath,
  });
  if (insertErr) throw insertErr;

  return { concept_id: conceptId };
}
