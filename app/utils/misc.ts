import type { Role } from "@prisma/client";
import { useMemo } from "react";
import { useMatches } from "react-router";

import type { User } from "~/models/user.server";

const DEFAULT_REDIRECT = "/";

type UserWithRole = User & {
  role: Role;
};

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

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(
  id: string,
): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id],
  );
  return route?.data as Record<string, unknown>;
}

function isUserWithRole(user: unknown): user is UserWithRole {
  return (
    user != null &&
    typeof user === "object" &&
    "email" in user &&
    typeof user.email === "string" &&
    "role" in user &&
    user.role != null &&
    typeof user.role === "object" &&
    "name" in user.role &&
    typeof user.role.name === "string"
  );
}

export function useOptionalUser(): UserWithRole | undefined {
  const data = useMatchesData("root");
  if (!data || !isUserWithRole(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): UserWithRole {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.",
    );
  }
  return maybeUser;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export function offsetDate(date: Date, minutesOffset = 0): Date {
  const newDate = new Date(date);

  newDate.setMinutes(date.getMinutes() + minutesOffset);

  return newDate;
}

export function getDomainUrl(request: Request) {
  const host =
    request.headers.get("X-Forwarded-Host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

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

export function getImageUrl(imageId: string) {
  return `/file/${imageId}`;
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

export function dateFormatBuilder(preferredLocale: string) {
  return Intl.DateTimeFormat(preferredLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
}
