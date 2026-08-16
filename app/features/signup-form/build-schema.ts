import z from "zod";

import { buildSubmissionSchema } from "~/features/forms/build-submission-schema";
import type { FieldDescriptor } from "~/features/forms/fields";

export function buildSignupSchema(descriptors: Array<FieldDescriptor>) {
  return buildSubmissionSchema(descriptors)
    .extend({
      acceptedPrivacy: z.boolean({ error: "You must agree to signup" }),
    })
    .refine((value) => value.acceptedPrivacy === true, {
      path: ["acceptedPrivacy"],
      error: "You must agree to register",
    });
}
