import type { FieldMetadata } from "@conform-to/react";
import type z from "zod";

type Fieldset<S extends z.ZodType> = {
  [K in keyof z.infer<S>]-?: FieldMetadata<z.infer<S>[K]>;
};

export type Block<
  ViewSchema extends z.ZodType = z.ZodType,
  ViewComponentProps extends object = {},
  EditorSchema extends z.ZodType = ViewSchema,
  EditorComponentProps extends object = ViewComponentProps,
> = {
  viewSchema: ViewSchema;
  viewComponent: React.ComponentType<
    { data: z.infer<ViewSchema> } & ViewComponentProps
  >;
  editorSchema: EditorSchema;
  editorComponent: React.ComponentType<
    { fields: Fieldset<EditorSchema> } & EditorComponentProps
  >;
};

export type BlockRegistry = Record<string, Block>;
