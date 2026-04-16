import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import { renderCmsBlock, type CmsBlock } from "./registry";

describe("renderCmsBlock", () => {
  test.each<CmsBlock>([
    {
      type: "hero",
      version: 1,
      data: {
        headline: "moku pona",
        actions: [{ href: "/dinners", label: "join a dinner" }],
        image: { src: "/hero-image.jpg" },
      },
    },
    {
      type: "text-section",
      version: 1,
      data: {
        headline: "our vision",
        body: "body",
        variant: "plain",
      },
    },
    {
      type: "image",
      version: 1,
      data: {
        image: { src: "/accent-image.png", alt: "" },
        variant: "default",
      },
    },
  ])("renders %s blocks with the central renderer", (block) => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {}, renderCmsBlock(block, block.type)),
    );

    expect(html).toBeTruthy();
  });
});
