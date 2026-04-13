import { heroBlockDefinition } from "./blocks/hero";
import { imageBlockDefinition } from "./blocks/image";
import { textSectionBlockDefinition } from "./blocks/text-section";
import { createCmsCatalog } from "./catalog";
import { homePageDefinition } from "./pages/home";

export const siteCmsCatalog = createCmsCatalog({
  blocks: [
    heroBlockDefinition,
    textSectionBlockDefinition,
    imageBlockDefinition,
  ],
  pages: [homePageDefinition],
});
