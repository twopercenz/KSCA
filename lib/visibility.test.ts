// lib/visibility.test.ts
import { describe, it, expect } from 'vitest';
import { canView } from './visibility';

const publicPaper = { status: 'public' as const, author_id: 'author-1' };
const hiddenPaper = { status: 'hidden' as const, author_id: 'author-1' };

describe('canView', () => {
  it('allows anyone to view public content', () => {
    expect(canView(publicPaper, null, null)).toBe(true);
  });
  it('denies anonymous viewers on hidden content', () => {
    expect(canView(hiddenPaper, null, null)).toBe(false);
  });
  it('denies a different logged-in user on hidden content', () => {
    expect(canView(hiddenPaper, 'someone-else', 'user')).toBe(false);
  });
  it('allows the author to view their own hidden content', () => {
    expect(canView(hiddenPaper, 'author-1', 'user')).toBe(true);
  });
  it('allows an admin to view any hidden content', () => {
    expect(canView(hiddenPaper, 'admin-1', 'admin')).toBe(true);
  });
});
