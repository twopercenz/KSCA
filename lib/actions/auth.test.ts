// lib/actions/auth.test.ts
import { describe, it, expect } from 'vitest';
import { parseSignupForm } from './auth';

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe('parseSignupForm', () => {
  it('extracts email, password, nickname, and optional school', () => {
    const result = parseSignupForm(
      fd({ email: 'a@b.com', password: 'secret123', nickname: '민준', school: '한빛고' })
    );
    expect(result).toEqual({
      email: 'a@b.com',
      password: 'secret123',
      nickname: '민준',
      school: '한빛고',
    });
  });

  it('treats a blank school as null', () => {
    const result = parseSignupForm(fd({ email: 'a@b.com', password: 'secret123', nickname: '민준', school: '' }));
    expect(result.school).toBeNull();
  });
});
