import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          KSCA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/papers">아카이브</Link>
          <Link href="/board">게시판</Link>
          {user ? (
            <>
              <Link href="/me">마이페이지</Link>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  로그아웃
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <Link href="/signup">회원가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
