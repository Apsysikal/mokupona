import { TextSectionBlockEditor } from "./editor";
import { type TextSectionBlock, schema } from "./model";
import { TextSectionBlockView } from "./view";

export const textSectionBlock = {
  viewSchema: schema,
  viewComponent: TextSectionBlockView,
  editorSchema: schema,
  editorComponent: TextSectionBlockEditor,
} satisfies TextSectionBlock;
