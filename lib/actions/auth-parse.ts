// lib/actions/auth-parse.ts
// Pure form-parsing helper, kept out of `auth.ts` because a `'use server'`
// module may only export async Server Actions (Next.js 16 enforces this at
// build time) — this file carries no directive so it stays a plain sync export.

export function parseSignupForm(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const nickname = String(formData.get('nickname') ?? '');
  const schoolRaw = String(formData.get('school') ?? '').trim();
  return { email, password, nickname, school: schoolRaw === '' ? null : schoolRaw };
}
