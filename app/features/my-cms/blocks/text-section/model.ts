import type React from "react";
import z from "zod";

import type { Fieldset, FormMapper } from "../types";

export const schema = z.object({
  headline: z.string(),
  body: z.string(),
  variant: z.literal(["plain", "slanted"]),
});

export const formMapper: FormMapper<typeof schema, typeof schema> = {
  fromForm: async (d) => d,
  toForm: (d) => d,
};

export type ViewProps = {
  data: z.infer<typeof schema>;
} & React.ComponentProps<"div">;
export type EditorProps = {
  fields: Fieldset<typeof schema>;
} & React.ComponentProps<"div">;
