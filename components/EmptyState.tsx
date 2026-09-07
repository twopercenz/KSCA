// components/EmptyState.tsx
export function EmptyState({ message }: { message: string }) {
  return <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">{message}</p>;
}
