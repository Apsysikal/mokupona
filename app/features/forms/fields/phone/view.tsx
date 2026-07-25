import type z from "zod";

import { makeInputFieldView } from "../input-view";

import type { PhoneFieldSchema } from "./model";

export const PhoneField =
  makeInputFieldView<z.infer<typeof PhoneFieldSchema>>("tel");
