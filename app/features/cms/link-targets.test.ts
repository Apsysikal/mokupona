import { describe, expect, test } from "vitest";

import { createLinkTargetRegistry } from "./link-targets";

describe("createLinkTargetRegistry", () => {
  test("exposes targets in registration order", () => {
    const registry = createLinkTargetRegistry([
      { key: "dinners", label: "Dinners", href: "/dinners" },
      { key: "join", label: "Join", href: "/join" },
    ]);

    expect(registry.targets).toEqual([
      { key: "dinners", label: "Dinners", href: "/dinners" },
      { key: "join", label: "Join", href: "/join" },
    ]);
  });

  test("byHref provides lookup by stored href value", () => {
    const registry = createLinkTargetRegistry([
      { key: "dinners", label: "Dinners", href: "/dinners" },
      { key: "join", label: "Join", href: "/join" },
    ]);

    expect(registry.byHref["/dinners"]).toEqual({
      key: "dinners",
      label: "Dinners",
      href: "/dinners",
    });
    expect(registry.byHref["/join"]).toEqual({
      key: "join",
      label: "Join",
      href: "/join",
    });
    expect(registry.byHref["/unknown"]).toBeUndefined();
  });

  test("works with an empty target list", () => {
    const registry = createLinkTargetRegistry([]);

    expect(registry.targets).toEqual([]);
    expect(registry.byHref).toEqual({});
  });

  test("supports optional external flag", () => {
    const registry = createLinkTargetRegistry([
      {
        key: "instagram",
        label: "Instagram",
        href: "https://instagram.com",
        external: true,
      },
    ]);

    expect(registry.targets[0].external).toBe(true);
    expect(registry.byHref["https://instagram.com"]?.external).toBe(true);
  });
});
