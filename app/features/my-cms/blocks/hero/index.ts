import { HeroSectionBlockEditor } from "./editor";
import { editorSchema, type HeroSectionBlock, schema } from "./model";
import { HeroSectionBlockView } from "./view";

export const heroSectionBlock = {
  viewSchema: schema,
  viewComponent: HeroSectionBlockView,
  editorSchema: editorSchema,
  editorComponent: HeroSectionBlockEditor,
} satisfies HeroSectionBlock;
