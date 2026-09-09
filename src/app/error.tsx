'use client';

import { Button } from '@/shared/components/ui/button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
