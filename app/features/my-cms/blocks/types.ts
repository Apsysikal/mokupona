import type { FieldMetadata } from "@conform-to/react";
import z from "zod";

/**
 * This function makes keys of the object required
 * but preservers the optionality of values that might
 * exist.
 */
type RequiredKeys<T extends z.ZodType> = {
  [P in keyof Required<z.infer<T>>]: z.infer<T>[P];
};

type ViewBlockPartial<S extends z.ZodType, P extends {}> = {
  schema: S;
  component: React.ComponentType<{ data: z.infer<S> } & P>;
};

type EditorBlockPartial<S extends z.ZodType, P extends {}> = {
  schema: S;
  component: React.ComponentType<
    {
      fields: FieldMetadata<RequiredKeys<S>>;
    } & P
  >;
};

export type BaseBlock<
  ViewSchema extends z.ZodType = z.ZodType,
  ViewBlockProps extends {} = {},
  EditorSchema extends z.ZodType = z.ZodType,
  EditorBlockProps extends {} = {},
> = {
  view: ViewBlockPartial<ViewSchema, ViewBlockProps>;
  editor: EditorBlockPartial<EditorSchema, EditorBlockProps>;
  migrations: Migration[];
  transforms: {
    toForm: (d: z.infer<ViewSchema>) => Promise<z.infer<EditorSchema>>;
    fromForm: (d: z.infer<EditorSchema>) => Promise<z.infer<ViewSchema>>;
  };
};

type MigrationFunction = (input: unknown) => unknown;

export type Migration = {
  from: number;
  to: number;
  fn: MigrationFunction;
};
