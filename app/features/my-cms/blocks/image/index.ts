import { ImageBlockEditor } from "./editor";
import {
  editorSchema,
  formMapper,
  type ImageSectionBlock,
  schema,
} from "./model";
import { ImageBlockView } from "./view";

export const imageSectionBlock = {
  viewSchema: schema,
  viewComponent: ImageBlockView,
  editorSchema: editorSchema,
  editorComponent: ImageBlockEditor,
  formMapper,
} satisfies ImageSectionBlock;

export { migrations } from "./migrations";
