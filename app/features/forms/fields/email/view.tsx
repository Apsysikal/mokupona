import type z from "zod";

import { makeInputFieldView } from "../input-view";

import type { EmailFieldSchema } from "./model";

export const EmailField =
  makeInputFieldView<z.infer<typeof EmailFieldSchema>>("email");
