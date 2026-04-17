import { heroBlockDefinition } from "./blocks/hero";
import { imageBlockDefinition } from "./blocks/image";
import { textSectionBlockDefinition } from "./blocks/text-section";
import { createCmsCatalog, type InferBlockType } from "./catalog";
import { homePageDefinition } from "./pages/home";

export type CmsBlock =
  | InferBlockType<typeof heroBlockDefinition>
  | InferBlockType<typeof textSectionBlockDefinition>
  | InferBlockType<typeof imageBlockDefinition>;

export const siteCmsCatalog = createCmsCatalog({
  blocks: [
    heroBlockDefinition,
    textSectionBlockDefinition,
    imageBlockDefinition,
  ],
  pages: [homePageDefinition],
});
