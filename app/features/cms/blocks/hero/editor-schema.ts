import { z } from "zod/v4";

import type { BlockRef } from "../block-ref";

import { createHeroActionSchema, type HeroBlockType } from "./model";

import type { LinkTargetRegistry } from "~/features/cms/link-targets";

export type HeroBlockEditorFormShape = {
  eyebrow: string;
  headline: string;
  description: string;
  actions: [{ label: string; href: string }];
};

export type HeroBlockEditorFormValue = {
  eyebrow?: string;
  headline: string;
  description?: string;
  actions: [{ label: string; href: string }];
};

export function createHeroBlockEditorFormSchema(
  linkTargetRegistry: LinkTargetRegistry,
) {
  return z.object({
    eyebrow: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
    headline: z
      .string({ error: "Headline is required" })
      .trim()
      .min(1, "Headline is required"),
    description: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
    actions: z.tuple([
      createHeroActionSchema(linkTargetRegistry).pick({
        label: true,
        href: true,
      }),
    ]),
  });
}

export function getHeroBlockEditorDefaultValue(
  data: HeroBlockType["data"],
  linkTargetRegistry: LinkTargetRegistry,
): HeroBlockEditorFormShape {
  const action = data.actions[0];

  return {
    eyebrow: data.eyebrow ?? "",
    headline: data.headline,
    description: data.description ?? "",
    actions: [
      {
        label: action?.label ?? "",
        href: action?.href ?? linkTargetRegistry.targets[0]?.href ?? "",
      },
    ],
  };
}

export function applyHeroBlockEditorValue(
  currentData: HeroBlockType["data"],
  value: HeroBlockEditorFormValue,
): HeroBlockType["data"] {
  return {
    ...currentData,
    eyebrow: value.eyebrow,
    headline: value.headline,
    description: value.description,
    actions: [
      {
        ...(currentData.actions[0] ?? {}),
        label: value.actions[0].label,
        href: value.actions[0].href,
      },
    ],
  };
}

export function getHeroBlockEditorFormId(blockRef: BlockRef) {
  switch (blockRef.kind) {
    case "definition-key":
      return `hero-block-editor-${blockRef.definitionKey}`;
    case "page-block-id":
      return `hero-block-editor-${blockRef.pageBlockId}`;
  }
}
