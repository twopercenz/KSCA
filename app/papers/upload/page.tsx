// app/papers/upload/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, AuthRequiredError } from '@/lib/auth';
import { PaperUploadForm } from '@/components/PaperUploadForm';

export default async function PaperUploadPage() {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
  } catch (e) {
    if (e instanceof AuthRequiredError) redirect('/login');
    throw e;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">논문 업로드</h1>
      <PaperUploadForm />
    </div>
  );
}
