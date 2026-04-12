import { describe, expect, test } from "vitest";

import { heroBlockDefinition } from "./blocks/hero";
import { imageBlockDefinition } from "./blocks/image";
import { textSectionBlockDefinition } from "./blocks/text-section";
import { createCmsCatalog } from "./catalog";
import { homePageDefinition } from "./pages/home";

describe("createCmsCatalog", () => {
  test("reads the default-backed home page and derives its public projection", () => {
    const domainUrl = new URL("https://mokupona.test");
    const catalog = createCmsCatalog({
      blocks: [
        heroBlockDefinition,
        textSectionBlockDefinition,
        imageBlockDefinition,
      ],
      pages: [homePageDefinition],
    });

    const snapshot = catalog.readPageSnapshot("home");

    expect(snapshot.pageKey).toBe("home");
    expect(snapshot.provenance).toBe("default");
    expect(snapshot.title).toBe("moku pona");
    expect(snapshot.description).toBe(
      "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
    );
    expect(snapshot.blocks.map(({ type }) => type)).toEqual([
      "hero",
      "text-section",
      "image",
      "text-section",
      "text-section",
    ]);

    const projection = catalog.projectPublic("home", {
      domainUrl,
      pathname: "/",
    });

    expect(projection.blocks.map(({ type }) => type)).toEqual(
      snapshot.blocks.map(({ type }) => type),
    );
    expect(projection.meta).toEqual([
      { title: "moku pona" },
      {
        name: "description",
        content:
          "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
      },
      { property: "og:title", content: "moku pona" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: new URL("/landing-page-default.jpg", domainUrl),
      },
      {
        property: "og:url",
        content: new URL("/", domainUrl),
      },
    ]);
  });

  test("fails fast when a page definition references an unknown block type", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [heroBlockDefinition],
        pages: [
          {
            pageKey: "broken-home",
            defaults: {
              title: "broken home",
              description: "broken description",
              blocks: [
                {
                  type: "text-section",
                  version: 1,
                  data: {
                    headline: "unsupported",
                    body: "unsupported body",
                    variant: "plain",
                  },
                },
              ],
            },
            rules: {
              allowedBlockTypes: ["text-section"],
            },
          },
        ],
      }),
    ).toThrow(
      'Unknown Block Type in Page Definition "broken-home": text-section',
    );
  });
});
