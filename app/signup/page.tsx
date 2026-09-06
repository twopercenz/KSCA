// app/signup/page.tsx
import { signUp } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">회원가입</h1>
      <form action={signUp} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="nickname">닉네임</Label>
          <Input id="nickname" name="nickname" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="school">학교 (선택)</Label>
          <Input id="school" name="school" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <Button type="submit" className="w-full">
          가입하기
        </Button>
      </form>
    </div>
  );
}
