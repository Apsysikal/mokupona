/** Throws the conventional 404 response when a looked-up record is absent. */
export function requireFound<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Response("Not found", { status: 404 });
  }
  return value;
}
