export function getClientHints(request: Request) {
  return {
    userTimezoneOffset: getTimezoneOffset(request),
    userTimezone: getTimezone(request),
    userLocale: getLocale(request),
  };
}

export function getTimezoneOffset(request: Request): number {
  const cookies = request.headers.get("Cookie")?.split("; ");

  if (!cookies) return 0;

  const offsetCookie = cookies.filter((cookie) => {
    return cookie.startsWith("clockOffset");
  });

  if (offsetCookie.length === 0) return 0;

  const offset = offsetCookie[0].split("=")[1];

  if (!offset) return 0;
  return Number(offset);
}

export function getTimezone(request: Request): string {
  const cookies = request.headers.get("Cookie")?.split("; ");

  if (!cookies) return "UTC";

  const timeZoneCookie = cookies.filter((cookie) => {
    return cookie.startsWith("timeZone");
  });

  if (timeZoneCookie.length === 0) return "UTC";

  const timeZone = timeZoneCookie[0].split("=")[1];

  if (!timeZone) return "UTC";
  return String(timeZone);
}

export function getLocale(request: Request): string {
  const cookies = request.headers.get("Cookie")?.split("; ");

  if (!cookies) return "de-DE";

  const localeCookie = cookies.filter((cookie) => {
    return cookie.startsWith("locale");
  });

  if (localeCookie.length === 0) return "de-DE";

  const locale = localeCookie[0].split("=")[1];

  if (!locale) return "de-DE";
  return String(locale);
}
