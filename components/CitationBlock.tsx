// components/CitationBlock.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatAPA, formatBibTeX, type CitationInput } from '@/lib/citation';

export function CitationBlock({ paper }: { paper: CitationInput }) {
  const [copied, setCopied] = useState<'apa' | 'bibtex' | null>(null);

  async function copy(format: 'apa' | 'bibtex', text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 1500);
  }

  const apa = formatAPA(paper);
  const bibtex = formatBibTeX(paper);

  return (
    <div className="space-y-3 rounded border p-4 text-sm">
      <div>
        <p className="font-medium">APA</p>
        <p className="mt-1 whitespace-pre-wrap">{apa}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => copy('apa', apa)}>
          {copied === 'apa' ? '복사됨' : '복사'}
        </Button>
      </div>
      <div>
        <p className="font-medium">BibTeX</p>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{bibtex}</pre>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => copy('bibtex', bibtex)}>
          {copied === 'bibtex' ? '복사됨' : '복사'}
        </Button>
      </div>
    </div>
  );
}
