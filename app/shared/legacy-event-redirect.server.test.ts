import { describe, expect, it } from "vitest";

import {
  action as adminAction,
  loader as adminLoader,
} from "~/routes/admin_.dinners.$";
import { action, loader } from "~/routes/dinners.$";

describe("legacy event redirects", () => {
  it.each([
    ["/dinners", "/events"],
    ["/dinners/", "/events/"],
    [
      "/dinners/event-1?from=email&filter=past",
      "/events/event-1?from=email&filter=past",
    ],
    ["/admin/dinners", "/admin/events"],
    ["/admin/dinners/new", "/admin/events/new"],
    ["/admin/dinners/event-1/edit", "/admin/events/event-1/edit"],
    ["/admin/dinners/event-1/gallery", "/admin/events/event-1/gallery"],
    ["/admin/dinners/event-1/signups", "/admin/events/event-1/signups"],
    [
      "/admin/dinners/event-1/signups.csv?download=1",
      "/admin/events/event-1/signups.csv?download=1",
    ],
  ])("permanently redirects %s", (from, to) => {
    const handler = from.startsWith("/admin") ? adminLoader : loader;
    const response = handler({
      request: new Request(`https://mokupona.ch${from}`),
    });
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(to);
  });

  it.each([
    [action, "/dinners/event-1", "/events/event-1"],
    [
      adminAction,
      "/admin/dinners/event-1/delete",
      "/admin/events/event-1/delete",
    ],
  ])(
    "preserves the method and body of cached forms",
    async (handler, from, to) => {
      const request = new Request(`https://mokupona.ch${from}`, {
        method: "POST",
        body: "intent=submit",
      });
      const response = handler({ request });
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(to);
      expect(request.bodyUsed).toBe(false);
      expect(await request.text()).toBe("intent=submit");
    },
  );
});
