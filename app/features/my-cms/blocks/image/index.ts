import { defineBlock } from "../define";

import { ImageBlockEditor } from "./editor";
import { editorSchema, formMapper, schema } from "./model";
import { ImageBlockView } from "./view";

export const imageSectionBlock = defineBlock({
  viewSchema: schema,
  viewComponent: ImageBlockView,
  editorSchema,
  editorComponent: ImageBlockEditor,
  formMapper,
});

export { migrations } from "./migrations";
