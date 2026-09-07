// lib/papers-query.test.ts
import { describe, it, expect } from 'vitest';
import { parsePaperListParams } from './papers-query';

describe('parsePaperListParams', () => {
  it('defaults to latest sort and no tag filter', () => {
    expect(parsePaperListParams({})).toEqual({ sort: 'latest', tag: null });
  });

  it('accepts sort=views', () => {
    expect(parsePaperListParams({ sort: 'views' })).toEqual({ sort: 'views', tag: null });
  });

  it('falls back to latest for an unknown sort value', () => {
    expect(parsePaperListParams({ sort: 'bogus' })).toEqual({ sort: 'latest', tag: null });
  });

  it('passes through a tag filter', () => {
    expect(parsePaperListParams({ tag: 'AI' })).toEqual({ sort: 'latest', tag: 'AI' });
  });
});
