/** Throws the conventional 404 response when a looked-up record is absent. */
export function requireFound<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Response("Not found", { status: 404 });
  }
  return value;
}

const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT,
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

export function getDomainUrl(request: Request) {
  const host =
    request.headers.get("X-Forwarded-Host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/** Masks the local part of an email address for privacy-preserving logging. */
export function obscureEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name[0]}${new Array(name.length).join("*")}@${domain}`;
}

export function getClientIPAddress(request: Request) {
  const ip =
    request.headers.get("X-Client-IP") ??
    request.headers.get("X-Forwarded-For") ??
    request.headers.get("HTTP-X-Forwarded-For") ??
    request.headers.get("Fly-Client-IP");

  return ip;
}

/**
 * The 400 an action throws when the submitted `intent` matched no known
 * branch. The flows differ per route — only the terminal response is shared.
 */
export function unknownIntent() {
  return new Response("Unknown intent", { status: 400 });
}

/**
 * Combine multiple header objects into one (uses append so headers are not overridden)
 */
export function combineHeaders(
  ...headers: (ResponseInit["headers"] | null | undefined)[]
) {
  const combined = new Headers();
  for (const header of headers) {
    if (!header) continue;
    for (const [key, value] of new Headers(header).entries()) {
      combined.append(key, value);
    }
  }
  return combined;
}
