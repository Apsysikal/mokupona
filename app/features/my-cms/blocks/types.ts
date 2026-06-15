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
  formMapper: FormMapper<ViewSchema, EditorSchema>;
};

export type FormMapper<S extends z.ZodType, F extends z.ZodType> = {
  fromForm: (formData: z.output<F>) => Promise<z.output<S>>;
  toForm: (data: z.output<S>) => z.output<F>;
};

export type Migration = {
  baseVersion: number;
  currentVersion: number;
  schemas: Array<z.ZodType>;
  migrations: Array<(d: unknown) => unknown>;
};

export type BlockRegistry = Record<string, Block>;
export type MigrationRegistry = Record<string, Migration>;
