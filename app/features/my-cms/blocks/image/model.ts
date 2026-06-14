import type React from "react";
import z from "zod";
import type { Block } from "../types";

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3;

export const schema = z.object({
  variant: z.literal(["default", "full-width"]),
  image: z.object({
    imageId: z.string().trim().min(1),
    alt: z.string().trim().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
});

export const editorSchema = z
  .object({
    variant: schema.shape.variant,
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

export type ImageSectionBlock = Block<
  typeof schema,
  React.ComponentProps<"picture">,
  typeof editorSchema,
  React.ComponentProps<"div">
>;

export type ViewProps = React.ComponentProps<
  ImageSectionBlock["viewComponent"]
>;

export type EditorProps = React.ComponentProps<
  ImageSectionBlock["editorComponent"]
>;
