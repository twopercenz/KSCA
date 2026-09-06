// app/login/page.tsx
import { signIn } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { confirm } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">로그인</h1>
      {confirm && (
        <p className="rounded bg-muted p-3 text-sm">가입 확인 이메일을 보냈습니다. 이메일을 확인해주세요.</p>
      )}
      <form action={signIn} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <Button type="submit" className="w-full">
          로그인
        </Button>
      </form>
    </div>
  );
}
