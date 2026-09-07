// components/VersionBadge.tsx
import { Badge } from '@/components/ui/badge';

export function VersionBadge({ version }: { version: number }) {
  return <Badge variant="outline">v{version}에 작성됨</Badge>;
}
