import type z from "zod";

import { makeInputFieldView } from "../input-view";

import type { TextFieldSchema } from "./model";

export const TextField =
  makeInputFieldView<z.infer<typeof TextFieldSchema>>("text");
