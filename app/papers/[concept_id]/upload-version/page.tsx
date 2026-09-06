// app/papers/[concept_id]/upload-version/page.tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, AuthRequiredError } from '@/lib/auth';
import { PaperUploadForm } from '@/components/PaperUploadForm';

export default async function UploadVersionPage({ params }: { params: Promise<{ concept_id: string }> }) {
  const { concept_id } = await params;
  const supabase = await createClient();
  let userId: string;
  try {
    userId = (await requireUser(supabase)).id;
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    throw e;
  }

  const { data: latest } = await supabase
    .from('papers')
    .select('author_id, title')
    .eq('concept_id', concept_id)
    .order('version_no', { ascending: false })
    .limit(1)
    .single();

  if (!latest) notFound();
  if (latest.author_id !== userId) redirect(`/papers/${concept_id}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">새 버전 업로드 — {latest.title}</h1>
      <PaperUploadForm existingConceptId={concept_id} />
    </div>
  );
}
