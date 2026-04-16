import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import { renderCmsBlock, type CmsBlock } from "./registry";

const blocks: CmsBlock[] = [
  {
    type: "hero",
    version: 1,
    data: {
      eyebrow: undefined,
      headline: "moku pona",
      description: undefined,
      actions: [{ href: "/dinners", label: "join a dinner" }],
      image: { kind: "asset", src: "/hero-image.jpg" },
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
      image: { kind: "asset", src: "/accent-image.png", alt: "" },
      variant: "default",
    },
  },
];

describe("renderCmsBlock", () => {
  test.each(blocks)(
    "renders $type blocks with the central renderer",
    (block) => {
      const html = renderToStaticMarkup(
        createElement(MemoryRouter, {}, renderCmsBlock(block, block.type)),
      );

      expect(html).toBeTruthy();
    },
  );
});
