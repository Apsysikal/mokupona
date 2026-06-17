import type { ComponentType } from "react";
import type z from "zod";

import type { Fieldset, FormMapper } from "./types";

/**
 * Defines a block with the schema as the single source of truth.
 *
 * The component constraints (`ComponentType<{ data: z.infer<VS> }>` /
 * `ComponentType<{ fields: Fieldset<ES> }>`) tie each component to its schema.
 * Because every element-level extra prop is optional, the *full* component type
 * still infers through `VC` / `EC` (the constraint doesn't strip it), so the
 * returned block carries each component's exact extras. Those are recovered
 * downstream as `Omit<ComponentProps<…>, "data" | "fields">` — by `<BlockView>`
 * / `<BlockEditor>` (to forward shared extras) and by the registry types.
 */
export function defineBlock<
  VS extends z.ZodType,
  VC extends ComponentType<{ data: z.infer<VS> }>,
  ES extends z.ZodType,
  EC extends ComponentType<{ fields: Fieldset<ES> }>,
>(block: {
  viewSchema: VS;
  viewComponent: VC;
  editorSchema: ES;
  editorComponent: EC;
  formMapper: FormMapper<VS, ES>;
}) {
  return block;
}
