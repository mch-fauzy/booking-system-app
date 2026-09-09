import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">That booking or page does not exist.</p>
      <Link className="underline" href="/">Book a trial class</Link>
    </div>
  );
}
