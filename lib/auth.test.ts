// lib/auth.test.ts
import { describe, it, expect } from 'vitest';
import { requireUser, AuthRequiredError } from './auth';

function stubSupabase(user: { id: string } | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
  } as any;
}

describe('requireUser', () => {
  it('returns the user when a session exists', async () => {
    const user = await requireUser(stubSupabase({ id: 'u1' }));
    expect(user.id).toBe('u1');
  });

  it('throws AuthRequiredError when there is no session', async () => {
    await expect(requireUser(stubSupabase(null))).rejects.toBeInstanceOf(AuthRequiredError);
  });
});
