import z from "zod";

import { buildSubmissionSchema } from "~/features/forms/build-submission-schema";
import type { FieldDescriptor } from "~/features/forms/fields";

// acceptedPrivacy is a legal control hardcoded into the signup page, never a
// schema field. It keeps the live form's field name.
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
