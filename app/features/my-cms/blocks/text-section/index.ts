import { defineBlock } from "../define";

import { TextSectionBlockEditor } from "./editor";
import { formMapper, schema } from "./model";
import { TextSectionBlockView } from "./view";

export const textSectionBlock = defineBlock({
  viewSchema: schema,
  viewComponent: TextSectionBlockView,
  editorSchema: schema,
  editorComponent: TextSectionBlockEditor,
  formMapper,
});

export { migrations } from "./migrations";
