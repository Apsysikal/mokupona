import { defineBlock } from "../define";

import { HeroSectionBlockEditor } from "./editor";
import { editorSchema, formMapper, schema } from "./model";
import { HeroSectionBlockView } from "./view";

export const heroSectionBlock = defineBlock({
  viewSchema: schema,
  viewComponent: HeroSectionBlockView,
  editorSchema,
  editorComponent: HeroSectionBlockEditor,
  formMapper,
});

export { migrations } from "./migrations";
