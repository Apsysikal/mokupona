import { describe, expect, test } from "vitest";
import { z } from "zod/v4";

import { heroBlockDefinition } from "./blocks/hero";
import { imageBlockDefinition } from "./blocks/image";
import { textSectionBlockDefinition } from "./blocks/text-section";
import type { BlockBaseType } from "./blocks/types";
import {
  createCmsCatalog,
  defineBlockDefinition,
  definePageDefinition,
} from "./catalog";
import { homePageDefinition } from "./pages/home";

type HeroStubBlock = BlockBaseType<"hero", 1, { label: string }>;
type TextSectionStubBlock = BlockBaseType<"text-section", 1, { label: string }>;

const heroStubDefinition = defineBlockDefinition<HeroStubBlock>({
  type: "hero",
  version: 1,
  schema: z.object({ label: z.string() }),
  render() {
    return null;
  },
});

const textSectionStubDefinition = defineBlockDefinition<TextSectionStubBlock>({
  type: "text-section",
  version: 1,
  schema: z.object({ label: z.string() }),
  render() {
    return null;
  },
});

const stubPageDefinition = definePageDefinition({
  pageKey: "home",
  defaults: {
    title: "test title",
    description: "test description",
    shareImageSrc: "/share.jpg",
    blocks: [
      {
        definitionKey: "hero-main",
        type: "hero",
        version: 1,
        data: { label: "first block" },
      },
      {
        type: "text-section",
        version: 1,
        data: { label: "second block" },
      },
    ],
  },
  rules: {
    allowedBlockTypes: ["hero", "text-section"],
    requiredLeadingBlockTypes: ["hero"],
  },
});

function createStubCatalog() {
  return createCmsCatalog({
    blocks: [heroStubDefinition, textSectionStubDefinition],
    pages: [stubPageDefinition],
  });
}

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

    const projection = catalog.projectPublic(snapshot, {
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
        content: new URL("/landing-page-default.jpg", domainUrl).toString(),
      },
      {
        property: "og:url",
        content: new URL("/", domainUrl).toString(),
      },
    ]);
  });

  test("clones default blocks for snapshots and projections", () => {
    const catalog = createStubCatalog();

    const snapshot = catalog.readPageSnapshot("home");
    (snapshot.blocks[0] as HeroStubBlock).data.label = "mutated snapshot";

    const nextSnapshot = catalog.readPageSnapshot("home");
    expect((nextSnapshot.blocks[0] as HeroStubBlock).data.label).toBe(
      "first block",
    );

    const projectionSnapshot = catalog.readPageSnapshot("home");
    const projection = catalog.projectPublic(projectionSnapshot, {
      pathname: "/",
    });
    (projection.blocks[1] as TextSectionStubBlock).data.label =
      "mutated projection";

    const nextProjection = catalog.projectPublic(
      catalog.readPageSnapshot("home"),
      { pathname: "/" },
    );
    expect((nextProjection.blocks[1] as TextSectionStubBlock).data.label).toBe(
      "second block",
    );
  });

  test("supports a string domainUrl in the public projection context", () => {
    const catalog = createStubCatalog();
    const snapshot = catalog.readPageSnapshot("home");

    const projection = catalog.projectPublic(snapshot, {
      domainUrl: "https://mokupona.test",
      pathname: "/",
    });

    expect(projection.meta).toEqual([
      { title: "test title" },
      { name: "description", content: "test description" },
      { property: "og:title", content: "test title" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: new URL("/share.jpg", "https://mokupona.test").toString(),
      },
      {
        property: "og:url",
        content: new URL("/", "https://mokupona.test").toString(),
      },
    ]);
  });

  test("omits og tags when domainUrl is missing", () => {
    const catalog = createStubCatalog();
    const snapshot = catalog.readPageSnapshot("home");

    const projection = catalog.projectPublic(snapshot, { pathname: "/" });

    expect(projection.meta).toEqual([
      { title: "test title" },
      { name: "description", content: "test description" },
    ]);
  });

  test("omits og:image when a page definition has no share image", () => {
    const catalog = createCmsCatalog({
      blocks: [heroStubDefinition, textSectionStubDefinition],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "test title",
            description: "test description",
            blocks: stubPageDefinition.defaults.blocks,
          },
          rules: stubPageDefinition.rules,
        }),
      ],
    });
    const snapshot = catalog.readPageSnapshot("home");

    const projection = catalog.projectPublic(snapshot, {
      domainUrl: "https://mokupona.test",
      pathname: "/",
    });

    expect(projection.meta).toEqual([
      { title: "test title" },
      { name: "description", content: "test description" },
      { property: "og:title", content: "test title" },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: new URL("/", "https://mokupona.test").toString(),
      },
    ]);
  });

  test("derives the public projection from the provided page snapshot", () => {
    const catalog = createStubCatalog();
    const snapshot = catalog.readPageSnapshot("home");

    snapshot.title = "edited title";
    snapshot.description = "edited description";
    (snapshot.blocks[0] as HeroStubBlock).data.label = "edited first block";

    const projection = catalog.projectPublic(snapshot, {
      domainUrl: "https://mokupona.test",
      pathname: "/",
    });

    expect(projection.blocks).toEqual(snapshot.blocks);
    expect(projection.meta).toEqual([
      { title: "edited title" },
      { name: "description", content: "edited description" },
      { property: "og:title", content: "edited title" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: new URL("/share.jpg", "https://mokupona.test").toString(),
      },
      {
        property: "og:url",
        content: new URL("/", "https://mokupona.test").toString(),
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

  test("fails fast on duplicate block types", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [
          heroStubDefinition,
          defineBlockDefinition<HeroStubBlock>({
            type: "hero",
            version: 1,
            schema: z.object({ label: z.string() }),
            render() {
              return null;
            },
          }),
        ],
        pages: [stubPageDefinition],
      }),
    ).toThrow("Duplicate Block Type: hero");
  });

  test("fails fast on duplicate page keys", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [heroStubDefinition, textSectionStubDefinition],
        pages: [
          stubPageDefinition,
          definePageDefinition({
            ...stubPageDefinition,
          }),
        ],
      }),
    ).toThrow("Duplicate Page Key: home");
  });

  test("fails fast when a default block type is not allowed on the page", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [heroStubDefinition, textSectionStubDefinition],
        pages: [
          definePageDefinition({
            pageKey: "home",
            defaults: {
              title: "test title",
              description: "test description",
              blocks: [
                {
                  type: "text-section",
                  version: 1,
                  data: { label: "second block" },
                },
              ],
            },
            rules: {
              allowedBlockTypes: ["hero"],
            },
          }),
        ],
      }),
    ).toThrow(
      'Block Type "text-section" is not allowed on Page Definition "home"',
    );
  });

  test("fails fast when default block data does not satisfy the block schema", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [heroStubDefinition],
        pages: [
          definePageDefinition({
            pageKey: "home",
            defaults: {
              title: "test title",
              description: "test description",
              blocks: [
                {
                  type: "hero",
                  version: 1,
                  data: {} as HeroStubBlock["data"],
                },
              ],
            },
            rules: {
              allowedBlockTypes: ["hero"],
            },
          }),
        ],
      }),
    ).toThrow(
      'Invalid default block data for Page Definition "home" and Block Type "hero"',
    );
  });

  test("fails fast on duplicate definition keys within one page definition", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [heroStubDefinition, textSectionStubDefinition],
        pages: [
          definePageDefinition({
            pageKey: "home",
            defaults: {
              title: "test title",
              description: "test description",
              blocks: [
                {
                  definitionKey: "shared-key",
                  type: "hero",
                  version: 1,
                  data: { label: "first block" },
                },
                {
                  definitionKey: "shared-key",
                  type: "text-section",
                  version: 1,
                  data: { label: "second block" },
                },
              ],
            },
            rules: {
              allowedBlockTypes: ["hero", "text-section"],
            },
          }),
        ],
      }),
    ).toThrow(
      'Duplicate Definition Key "shared-key" on Page Definition "home"',
    );
  });

  test("fails fast when required leading block types do not match the defaults", () => {
    expect(() =>
      createCmsCatalog({
        blocks: [heroStubDefinition, textSectionStubDefinition],
        pages: [
          definePageDefinition({
            pageKey: "home",
            defaults: {
              title: "test title",
              description: "test description",
              blocks: [
                {
                  type: "text-section",
                  version: 1,
                  data: { label: "second block" },
                },
              ],
            },
            rules: {
              allowedBlockTypes: ["hero", "text-section"],
              requiredLeadingBlockTypes: ["hero"],
            },
          }),
        ],
      }),
    ).toThrow(
      'Page Definition "home" must start with Block Type "hero" at position 0',
    );
  });

  test("fails fast when reading an unknown page snapshot", () => {
    expect(() => createStubCatalog().readPageSnapshot("missing")).toThrow(
      "Unknown Page Key: missing",
    );
  });
});
