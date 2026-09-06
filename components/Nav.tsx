import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          KSCA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/papers">아카이브</Link>
          <Link href="/board">게시판</Link>
          <Link href="/login">로그인</Link>
        </nav>
      </div>
    </header>
  );
}
