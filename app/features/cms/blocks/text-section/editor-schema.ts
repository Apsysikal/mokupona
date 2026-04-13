import { z } from "zod/v4";

import type { BlockRef } from "../block-ref";

import type { TextSectionBlockType } from "./model";

export type TextSectionBlockEditorFormShape = {
  headline: string;
  body: string;
  variant: "plain" | "slanted";
};

export type TextSectionBlockEditorFormValue = {
  headline: string;
  body: string;
  variant: "plain" | "slanted";
};

export function createTextSectionBlockEditorFormSchema() {
  return z.object({
    headline: z
      .string({ error: "Headline is required" })
      .trim()
      .min(1, "Headline is required"),
    body: z
      .string({ error: "Body is required" })
      .trim()
      .min(1, "Body is required"),
    variant: z.enum(["plain", "slanted"]),
  });
}

export function getTextSectionBlockEditorDefaultValue(
  data: TextSectionBlockType["data"],
): TextSectionBlockEditorFormShape {
  return {
    headline: data.headline,
    body: data.body,
    variant: data.variant,
  };
}

export function applyTextSectionBlockEditorValue(
  _currentData: TextSectionBlockType["data"],
  value: TextSectionBlockEditorFormValue,
): TextSectionBlockType["data"] {
  return {
    headline: value.headline,
    body: value.body,
    variant: value.variant,
  };
}

export function getTextSectionBlockEditorFormId(blockRef: BlockRef): string {
  switch (blockRef.kind) {
    case "definition-key":
      return `text-section-block-editor-${blockRef.definitionKey}`;
    case "page-block-id":
      return `text-section-block-editor-${blockRef.pageBlockId}`;
  }
}
