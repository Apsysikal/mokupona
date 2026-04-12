import { expect, test } from "vitest";

import { heroBlockDefinition } from "../blocks/hero";
import { imageBlockDefinition } from "../blocks/image";
import { textSectionBlockDefinition } from "../blocks/text-section";
import { createCmsCatalog } from "../catalog";

import { homePageDefinition } from "./home";

test("home page definition keeps the fixed hero block in the first slot", () => {
  const catalog = createCmsCatalog({
    blocks: [
      heroBlockDefinition,
      textSectionBlockDefinition,
      imageBlockDefinition,
    ],
    pages: [homePageDefinition],
  });
  const snapshot = catalog.readPageSnapshot("home");

  expect(snapshot.blocks[0]).toMatchObject({
    definitionKey: "hero-main",
    type: "hero",
  });
  expect(snapshot.blocks.map(({ type }) => type)).toEqual([
    "hero",
    "text-section",
    "image",
    "text-section",
    "text-section",
  ]);
});
