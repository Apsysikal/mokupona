import { TextSectionBlockEditor } from "./editor";
import { type TextSectionBlock, formMapper, schema } from "./model";
import { TextSectionBlockView } from "./view";

export const textSectionBlock = {
  viewSchema: schema,
  viewComponent: TextSectionBlockView,
  editorSchema: schema,
  editorComponent: TextSectionBlockEditor,
  formMapper,
} satisfies TextSectionBlock;

export { migrations } from "./migrations";
