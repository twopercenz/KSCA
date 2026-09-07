// app/api/papers/[id]/download/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canView } from '@/lib/visibility';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data?.role ?? null
    : null;

  const { data: paper } = await supabase.from('papers').select('file_path, status, author_id').eq('id', id).single();
  if (!paper || !canView(paper, user?.id ?? null, role)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('papers').createSignedUrl(paper.file_path, 300);
  if (error || !data) {
    return NextResponse.json({ error: 'could not create signed url' }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
