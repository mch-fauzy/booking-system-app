// Null in production so 500s never leak internals.
export function errorDetail(err: unknown, isProduction: boolean): string | null {
  if (isProduction) return null;
  return err instanceof Error ? err.message : String(err);
}
