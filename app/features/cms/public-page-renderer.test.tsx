import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod/v4";

import type { BlockBaseType } from "./blocks/types";
import {
  createCmsCatalog,
  defineBlockDefinition,
  definePageDefinition,
} from "./catalog";
import { PublicPageRenderer } from "./public-page-renderer";

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
  const projection = catalog.projectPublic("home", { pathname: "/" });

  const html = renderToStaticMarkup(
    <PublicPageRenderer catalog={catalog} projection={projection} />,
  );

  expect(html).toContain("first block");
  expect(html).toContain("second block");
  expect(html.indexOf("first block")).toBeLessThan(
    html.indexOf("second block"),
  );
});
