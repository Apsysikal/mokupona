import { expect, test } from "vitest";

import { heroBlockDefinition } from "./hero";
import { imageBlockDefinition } from "./image";
import { textSectionBlockDefinition } from "./text-section";

import { homePageDefinition } from "~/features/cms/pages/home";

const expectedDefinitions = [
  heroBlockDefinition,
  textSectionBlockDefinition,
  imageBlockDefinition,
] as const;

test("existing block definitions validate the home page default blocks", () => {
  for (const definition of expectedDefinitions) {
    const matchingBlocks = homePageDefinition.defaults.blocks.filter(
      (block) => block.type === definition.type,
    );

    expect(matchingBlocks.length).toBeGreaterThan(0);
    expect(definition.version).toBe(1);

    for (const block of matchingBlocks) {
      expect(() => definition.schema.parse(block.data)).not.toThrow();
    }
  }
});
