import 'server-only';
import { notFound } from 'next/navigation';
import { HTTPException } from 'hono/http-exception';

// RSC pages: a service 404 becomes the Next.js not-found page; anything else propagates.
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof HTTPException && e.status === 404) notFound();
    throw e;
  }
}
