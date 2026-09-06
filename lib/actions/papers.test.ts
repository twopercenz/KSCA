// lib/actions/papers.test.ts
import { describe, it, expect } from 'vitest';
import { validateUploadRequest } from './papers';

describe('validateUploadRequest', () => {
  it('accepts a PDF under 20MB', () => {
    expect(validateUploadRequest({ fileName: 'x.pdf', fileSize: 10 * 1024 * 1024, fileType: 'application/pdf' })).toEqual({
      ok: true,
    });
  });

  it('rejects non-PDF types', () => {
    const r = validateUploadRequest({ fileName: 'x.docx', fileSize: 1000, fileType: 'application/msword' });
    expect(r.ok).toBe(false);
  });

  it('rejects files over 20MB', () => {
    const r = validateUploadRequest({
      fileName: 'x.pdf',
      fileSize: 21 * 1024 * 1024,
      fileType: 'application/pdf',
    });
    expect(r.ok).toBe(false);
  });
});
