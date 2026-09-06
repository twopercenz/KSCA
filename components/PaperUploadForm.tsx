// components/PaperUploadForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPaperUpload, createPaper } from '@/lib/actions/papers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function PaperUploadForm({ existingConceptId }: { existingConceptId?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const file = formData.get('file') as File;
      const { path, signedUrl } = await requestPaperUpload(file.name, file.size, file.type);

      const putRes = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } });
      if (!putRes.ok) throw new Error('파일 업로드에 실패했습니다.');

      const tags = String(formData.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const schoolRaw = String(formData.get('school') ?? '').trim();

      const { concept_id } = await createPaper({
        title: String(formData.get('title') ?? ''),
        authors: String(formData.get('authors') ?? ''),
        abstract: String(formData.get('abstract') ?? ''),
        tags,
        school: schoolRaw === '' ? null : schoolRaw,
        filePath: path,
        existingConceptId,
      });

      router.push(`/papers/${concept_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="authors">저자명 (본인 + 공동저자)</Label>
        <Input id="authors" name="authors" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="abstract">초록</Label>
        <Textarea id="abstract" name="abstract" required rows={6} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tags">분야 태그 (쉼표로 구분)</Label>
        <Input id="tags" name="tags" placeholder="AI, 데이터분석" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="school">학교명 (선택)</Label>
        <Input id="school" name="school" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="file">PDF 파일 (최대 20MB)</Label>
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? '업로드 중...' : '업로드'}
      </Button>
    </form>
  );
}
