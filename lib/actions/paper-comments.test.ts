// lib/actions/paper-comments.test.ts
import { describe, it, expect } from 'vitest';
import { validateCommentContent } from './validate-comment';

describe('validateCommentContent', () => {
  it('rejects empty content', () => {
    expect(validateCommentContent('   ').ok).toBe(false);
  });
  it('rejects content over 2000 characters', () => {
    expect(validateCommentContent('a'.repeat(2001)).ok).toBe(false);
  });
  it('accepts normal content', () => {
    expect(validateCommentContent('좋은 논문이네요!')).toEqual({ ok: true });
  });
});
