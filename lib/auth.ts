// lib/auth.ts
import type { User } from '@supabase/supabase-js';

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
  }
}

type SupabaseLike = {
  auth: { getUser: () => Promise<{ data: { user: User | null }; error: unknown }> };
};

export async function requireUser(supabase: SupabaseLike): Promise<User> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AuthRequiredError();
  return data.user;
}
