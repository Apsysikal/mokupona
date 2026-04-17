import type { ZodType } from "zod/v4";

import type { BlockRef } from "./block-ref";
import {
  applyHeroBlockEditorValue,
  createHeroBlockEditorFormSchema,
  getHeroBlockEditorDefaultValue,
  getHeroBlockEditorFormId,
  type HeroBlockEditorFormValue,
} from "./hero/editor-schema";
import type { HeroBlockData } from "./hero/model";
import {
  applyImageBlockEditorValue,
  createImageBlockEditorFormSchema,
  getImageBlockEditorDefaultValue,
  getImageBlockEditorFormId,
  type ImageBlockEditorFormValue,
} from "./image/editor-schema";
import type { ImageBlockData } from "./image/model";
import {
  applyTextSectionBlockEditorValue,
  createTextSectionBlockEditorFormSchema,
  getTextSectionBlockEditorDefaultValue,
  getTextSectionBlockEditorFormId,
  type TextSectionBlockEditorFormValue,
} from "./text-section/editor-schema";
import type { TextSectionBlockType } from "./text-section/model";

import type { LinkTargetRegistry } from "~/features/cms/link-targets";

export type BlockEditorApplyOptions = { uploadedImageId?: string };

export interface BlockEditor<TData, TFormValue> {
  readonly schema: ZodType<TFormValue>;
  defaultValue(data: TData): Record<string, unknown>;
  apply(
    currentData: TData,
    formValue: TFormValue,
    options?: BlockEditorApplyOptions,
  ): TData;
  formId(blockRef: BlockRef): string;
}

export function heroBlockEditor(deps: {
  linkTargetRegistry: LinkTargetRegistry;
}): BlockEditor<HeroBlockData, HeroBlockEditorFormValue> {
  const schema = createHeroBlockEditorFormSchema(deps.linkTargetRegistry);
  return {
    schema,
    defaultValue: (data) =>
      getHeroBlockEditorDefaultValue(data, deps.linkTargetRegistry),
    apply: (currentData, formValue, options) =>
      applyHeroBlockEditorValue(currentData, formValue, options),
    formId: getHeroBlockEditorFormId,
  };
}

export function imageBlockEditor(): BlockEditor<
  ImageBlockData,
  ImageBlockEditorFormValue
> {
  const schema = createImageBlockEditorFormSchema();
  return {
    schema,
    defaultValue: (data) => getImageBlockEditorDefaultValue(data),
    apply: (currentData, formValue, options) =>
      applyImageBlockEditorValue(currentData, formValue, options),
    formId: getImageBlockEditorFormId,
  };
}

export function textSectionBlockEditor(): BlockEditor<
  TextSectionBlockType["data"],
  TextSectionBlockEditorFormValue
> {
  const schema = createTextSectionBlockEditorFormSchema();
  return {
    schema,
    defaultValue: (data) => getTextSectionBlockEditorDefaultValue(data),
    apply: (currentData, formValue) =>
      applyTextSectionBlockEditorValue(currentData, formValue),
    formId: getTextSectionBlockEditorFormId,
  };
}
