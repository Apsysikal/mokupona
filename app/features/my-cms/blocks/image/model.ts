import type React from "react";
import z from "zod";

import type { Fieldset, FormMapper } from "../types";

import { saveImage } from "~/models/image.server";

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
      variant: fd.variant,
      image: { imageId, alt: fd.alt },
    };
  },
  toForm: (d) => {
    return {
      variant: d.variant,
      imageId: d.image.imageId,
      alt: d.image.alt,
    };
  },
};

export type ViewProps = {
  data: z.infer<typeof schema>;
} & React.ComponentProps<"picture">;

export type EditorProps = {
  fields: Fieldset<typeof editorSchema>;
} & React.ComponentProps<"div">;
