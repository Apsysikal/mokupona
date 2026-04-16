import { describe, expect, test } from "vitest";

import { getHomePageMeta, homePageBlocks } from "./home";

describe("home page definition", () => {
  test("registers all default home page blocks", () => {
    expect(homePageBlocks.map((block) => block.type)).toEqual([
      "hero",
      "text-section",
      "image",
      "text-section",
      "text-section",
    ]);
  });

  test("builds OpenGraph metadata when a domain is available", () => {
    const meta = getHomePageMeta({
      domainUrl: "https://example.com",
      pathname: "/",
    });

    expect(meta).toContainEqual({
      property: "og:image",
      content: "https://example.com/landing-page-default.jpg",
    });
    expect(meta).toContainEqual({
      property: "og:url",
      content: "https://example.com/",
    });
  });
});
