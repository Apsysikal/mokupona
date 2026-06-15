import type React from "react";
import z from "zod";
import { saveImage } from "~/models/image.server";
import { linkTargets } from "../link-targets";
import type { Block, FormMapper } from "../types";

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3;

const hrefValues = linkTargets.map((t) => t.href);

export const schema = z.object({
  eyebrow: z.string().trim().optional(),
  headline: z.string().trim().min(1, "Headline is required"),
  description: z.string().trim().min(1, "Description is required"),
  actions: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Label is required"),
        href: z.literal(hrefValues, "Choose a valid link target"),
        variant: z
          .literal(["primary", "secondary"])
          .optional()
          .default("primary"),
      }),
    )
    .min(1, "At least one call to action is requried")
    .max(2, "You cant add more than two calls to action"),
  image: z.object({
    imageId: z.string().trim().min(1),
    alt: z.string().trim().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
});

export const editorSchema = z
  .object({
    eyebrow: schema.shape.eyebrow,
    headline: schema.shape.headline,
    description: schema.shape.description,
    actions: schema.shape.actions,
    imageId: z.string().trim().optional(),
    imageFile: z
      .instanceof(File)
      .optional()
      .refine((f) => {
        if (!f) return true;
        return f.size > 0;
      }, "You must select a file")
      .refine((f) => {
        if (!f) return true;
        return f.size < MAX_UPLOAD_SIZE;
      }, "File cannot be greater than 3MB"),
    alt: z.string().trim().optional(),
  })
  .refine(
    (d) => {
      return Boolean(d.imageId) || Boolean(d.imageFile);
    },
    {
      error: "You must select a file",
      path: ["imageFile"],
    },
  );

export const formMapper: FormMapper<typeof schema, typeof editorSchema> = {
  fromForm: async (fd) => {
    let imageId = fd.imageId;

    if (fd.imageFile) {
      const image = await saveImage({ file: fd.imageFile, alt: fd.alt });
      imageId = image.id;
    }

    if (!imageId) {
      throw new Error(`No image provided, but it is required`);
    }

    return {
      eyebrow: fd.eyebrow,
      headline: fd.headline,
      description: fd.description,
      actions: fd.actions,
      image: { imageId, alt: fd.alt },
    };
  },
  toForm: (d) => {
    return {
      eyebrow: d.eyebrow,
      headline: d.headline,
      description: d.description,
      actions: d.actions,
      imageId: d.image.imageId,
      alt: d.image.alt,
    };
  },
};

export type HeroSectionBlock = Block<
  typeof schema,
  React.ComponentProps<"section">,
  typeof editorSchema,
  React.ComponentProps<"div">
>;

export type ViewProps = React.ComponentProps<HeroSectionBlock["viewComponent"]>;

export type EditorProps = React.ComponentProps<
  HeroSectionBlock["editorComponent"]
>;
