// lib/actions/paper-comments.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { validateCommentContent } from './validate-comment';

export async function addPaperComment(paperRowId: string, writtenAtVersion: number, content: string) {
  const check = validateCommentContent(content);
  if (!check.ok) throw new Error(check.error);

  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { error } = await supabase.from('paper_comments').insert({
    paper_id: paperRowId,
    author_id: user.id,
    content: content.trim(),
    written_at_version: writtenAtVersion,
  });
  if (error) throw error;
  revalidatePath('/papers/[concept_id]', 'page');
}

export async function getPaperComments(conceptId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('paper_comments')
    .select('id, content, written_at_version, status, created_at, author_id, papers!inner(concept_id), profiles(nickname)')
    .eq('papers.concept_id', conceptId)
    .order('created_at', { ascending: true });
  return data ?? [];
}
