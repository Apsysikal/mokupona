import { ImageBlockEditor } from "./editor";
import { editorSchema, type ImageSectionBlock, schema } from "./model";
import { ImageBlockView } from "./view";

export const imageSectionBlock = {
  viewSchema: schema,
  viewComponent: ImageBlockView,
  editorSchema: editorSchema,
  editorComponent: ImageBlockEditor,
} satisfies ImageSectionBlock;
