import { useMemo } from "react";
import { useMatches } from "react-router";

import type { Role } from "~/models/role.server";
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
function useMatchesData(id: string): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id],
  );
  return route?.loaderData as Record<string, unknown>;
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

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export function offsetDate(date: Date, minutesOffset = 0): Date {
  return new Date(date.getTime() + minutesOffset * 60 * 1000);
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

// The redesign writes all dates in a fixed, lowercase, Zurich-local shape
// ("saturday 9 may · 19:00"); a fixed locale keeps server and client render
// identical. Lowercasing happens here, not via CSS, so no caller can forget.
const EVENT_TIME_ZONE = "Europe/Zurich";

const eventTimeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: EVENT_TIME_ZONE,
});

/** "saturday 9 may · 19:00" (weekday: "long") / "sat 9 may · 19:00" ("short") */
export function formatEventDateLine(date: Date, weekday: "long" | "short") {
  const dayLine = new Intl.DateTimeFormat("en-GB", {
    weekday,
    day: "numeric",
    month: "long",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);

  return `${dayLine} · ${eventTimeFormat.format(date)}`.toLowerCase();
}

/** "Sun 12 Jul 2026 · 19:30" — admin meta lines keep their casing */
export function formatAdminDateLine(date: Date) {
  const dayLine = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);

  return `${dayLine} · ${eventTimeFormat.format(date)}`;
}

/** "2 Jul, 14:22" — admin signup timestamps */
export function formatAdminTimestamp(date: Date) {
  const dayMonth = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);

  return `${dayMonth}, ${eventTimeFormat.format(date)}`;
}

/** "apr 2026" — archive labels on past dinner cards */
export function formatEventMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  })
    .format(date)
    .toLowerCase();
}

/** "9 may" — the landing hero eyebrow */
export function formatEventDayMonth(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: EVENT_TIME_ZONE,
  })
    .format(date)
    .toLowerCase();
}
