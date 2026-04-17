import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { z } from "zod/v4";

import type { BlockBaseType } from "./blocks/types";
import {
  createCmsCatalog,
  defineBlockDefinition,
  definePageDefinition,
} from "./catalog";
import { PublicPageRenderer } from "./public-page-renderer";
import { siteCmsCatalog } from "./site-catalog";

type HeroStubBlock = BlockBaseType<"hero", 1, { label: string }>;
type TextSectionStubBlock = BlockBaseType<"text-section", 1, { label: string }>;

test("PublicPageRenderer renders projected blocks in page order", () => {
  const heroBlockDefinition = defineBlockDefinition<HeroStubBlock>({
    type: "hero",
    version: 1,
    schema: z.object({ label: z.string() }),
    render(block) {
      return <section>{block.data.label}</section>;
    },
  });
  const textSectionBlockDefinition =
    defineBlockDefinition<TextSectionStubBlock>({
      type: "text-section",
      version: 1,
      schema: z.object({ label: z.string() }),
      render(block) {
        return <article>{block.data.label}</article>;
      },
    });
  const pageDefinition = definePageDefinition({
    pageKey: "home",
    defaults: {
      title: "test title",
      description: "test description",
      blocks: [
        { type: "hero", version: 1, data: { label: "first block" } },
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
  const catalog = createCmsCatalog({
    blocks: [heroBlockDefinition, textSectionBlockDefinition],
    pages: [pageDefinition],
  });
  const projection = catalog.projectPublic(catalog.readPageSnapshot("home"), {
    pathname: "/",
  });

  const html = renderToStaticMarkup(
    <PublicPageRenderer catalog={catalog} view={projection} />,
  );

  expect(html).toContain("first block");
  expect(html).toContain("second block");
  expect(html.indexOf("first block")).toBeLessThan(
    html.indexOf("second block"),
  );
});

test("PublicPageRenderer renders the real home page through the site catalog", () => {
  const projection = siteCmsCatalog.projectPublic(
    siteCmsCatalog.readPageSnapshot("home"),
    { pathname: "/" },
  );

  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PublicPageRenderer catalog={siteCmsCatalog} view={projection} />
    </MemoryRouter>,
  );

  expect(html).toContain("moku pona");
  expect(html).toContain("our vision");
  expect(html).toContain("how&#x27;s this different?");
  expect(html).toContain("who we are");
  expect(html.indexOf("moku pona")).toBeLessThan(html.indexOf("our vision"));
  expect(html.indexOf("our vision")).toBeLessThan(
    html.indexOf("how&#x27;s this different?"),
  );
  expect(html.indexOf("how&#x27;s this different?")).toBeLessThan(
    html.indexOf("who we are"),
  );
});
