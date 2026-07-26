const USERINFO = /(?<=:\/\/)[^/@]*@/;

/**
 * A connection string reduced to what identifies the database — everything up
 * to the query string, with any credentials masked. The path is left exactly as
 * configured, so a relative sqlite path stays recognisable as one.
 */
export function redactDatabaseUrl(url: string | undefined): string {
  if (!url) return "[unset]";

  const [withoutQuery] = url.split(/[?#]/);

  return withoutQuery.replace(USERINFO, "redacted:redacted@");
}
