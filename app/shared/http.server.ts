import { isIP } from "node:net";

import { requestLogger } from "~/logger/request-context.server";

export function requireFound<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    requestLogger.warn("A looked-up record was absent");
    throw new Response("Not found", { status: 404 });
  }
  return value;
}

const DEFAULT_REDIRECT = "/";

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

export function getClientIPAddress(request: Request): string | null {
  const header = request.headers.get("Fly-Client-IP");
  if (!header || header.length > 64) return null;

  const value = header.trim().toLowerCase();
  const family = isIP(value);
  if (family === 0) return null;
  if (family === 4) return value;

  const mapped = /^(?:0*:)*0*ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  return mapped && isIP(mapped[1]) === 4 ? mapped[1] : value;
}

export function unknownIntent() {
  requestLogger.warn("An action received an unknown intent");
  return new Response("Unknown intent", { status: 400 });
}

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
