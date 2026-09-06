// The base URL is a placeholder until the association's real domain is
// registered (README §14 notes concept_id's prefix/registrar are still open).
const BASE_URL = 'https://ksca.dev';

export type CitationInput = {
  concept_id: string;
  authors: string;
  title: string;
  created_at: string;
  school: string | null;
};

function year(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

export function formatAPA(p: CitationInput): string {
  return `${p.authors} (${year(p.created_at)}). ${p.title}. KSCA. ${BASE_URL}/papers/${p.concept_id}`;
}

export function formatBibTeX(p: CitationInput): string {
  return [
    `@misc{${p.concept_id},`,
    `  author = {${p.authors}},`,
    `  title = {${p.title}},`,
    `  year = {${year(p.created_at)}},`,
    `  publisher = {KSCA},`,
    `  url = {${BASE_URL}/papers/${p.concept_id}}`,
    `}`,
  ].join('\n');
}
