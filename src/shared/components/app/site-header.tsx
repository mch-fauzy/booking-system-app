import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b">
      <nav aria-label="Main" className="mx-auto flex max-w-3xl gap-6 px-6 py-3 text-sm">
        <Link href="/" className="font-medium hover:underline">Book a trial</Link>
        <Link href="/admin" className="font-medium hover:underline">Admin roster</Link>
      </nav>
    </header>
  );
}
