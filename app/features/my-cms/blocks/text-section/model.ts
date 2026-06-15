import type React from "react";
import z from "zod";
import type { Block, FormMapper } from "../types";

export const schema = z.object({
  headline: z.string(),
  body: z.string(),
  variant: z.literal(["plain", "slanted"]),
});

export const formMapper: FormMapper<typeof schema, typeof schema> = {
  fromForm: async (d) => d,
  toForm: (d) => d,
};

export type TextSectionBlock = Block<
  typeof schema,
  React.ComponentProps<"div">
>;

export type ViewProps = React.ComponentProps<TextSectionBlock["viewComponent"]>;
export type EditorProps = React.ComponentProps<
  TextSectionBlock["editorComponent"]
>;
