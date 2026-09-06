import { describe, it, expect } from 'vitest';
import { formatAPA, formatBibTeX } from './citation';

const paper = {
  concept_id: 'KSCA-2026-000001',
  authors: '김민준',
  title: '청소년을 위한 강화학습 입문 실험',
  created_at: '2026-03-14T00:00:00.000Z',
  school: '한빛고등학교',
};

describe('formatAPA', () => {
  it('formats author, year, title, and identifier', () => {
    expect(formatAPA(paper)).toBe(
      '김민준 (2026). 청소년을 위한 강화학습 입문 실험. KSCA. https://ksca.dev/papers/KSCA-2026-000001'
    );
  });
});

describe('formatBibTeX', () => {
  it('formats a @misc entry keyed by concept_id', () => {
    expect(formatBibTeX(paper)).toBe(
      [
        '@misc{KSCA-2026-000001,',
        '  author = {김민준},',
        '  title = {청소년을 위한 강화학습 입문 실험},',
        '  year = {2026},',
        '  publisher = {KSCA},',
        '  url = {https://ksca.dev/papers/KSCA-2026-000001}',
        '}',
      ].join('\n')
    );
  });
});
