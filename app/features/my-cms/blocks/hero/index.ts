import { HeroSectionBlockEditor } from "./editor";
import {
  editorSchema,
  formMapper,
  type HeroSectionBlock,
  schema,
} from "./model";
import { HeroSectionBlockView } from "./view";

export const heroSectionBlock = {
  viewSchema: schema,
  viewComponent: HeroSectionBlockView,
  editorSchema: editorSchema,
  editorComponent: HeroSectionBlockEditor,
  formMapper,
} satisfies HeroSectionBlock;

export { migrations } from "./migrations";
