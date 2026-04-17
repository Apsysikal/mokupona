import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import { UnknownBlockTypeError } from "./catalog";
import { siteCmsCatalog, type CmsBlock } from "./site-catalog";

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

describe("siteCmsCatalog.renderBlock", () => {
  test.each(blocks)("renders $type blocks without throwing", (block) => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {},
        siteCmsCatalog.renderBlock(block, block.type),
      ),
    );

    expect(html).toBeTruthy();
  });

  test("throws UnknownBlockTypeError for unknown block types", () => {
    expect(() =>
      siteCmsCatalog.renderBlock(
        { type: "unknown" as never, version: 1, data: {} },
        "key",
      ),
    ).toThrow(UnknownBlockTypeError);
  });
});
