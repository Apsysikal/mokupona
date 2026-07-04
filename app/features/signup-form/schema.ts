import { FormSchema } from "~/features/forms/fields";

const FIXED_IDENTITY_FIELDS = ["name", "email", "phone"];

// The signup form profile: generic FormSchema plus the conventions the signup
// consumers rely on. The friends-list maxCount range (0-10) is already
// enforced by the generic ListFieldSchema bound.
export const SignupFormSchema = FormSchema.superRefine((fields, ctx) => {
  const lists = fields.filter((field) => field.type === "list");
  if (lists.length !== 1 || lists[0].data.name !== "friends") {
    ctx.addIssue({
      code: "custom",
      message: 'A signup form must contain exactly one list named "friends"',
    });
  }

  for (const name of FIXED_IDENTITY_FIELDS) {
    const field = fields.find(
      (candidate) => candidate.type !== "list" && candidate.data.name === name,
    );
    if (!field || !field.data.required) {
      ctx.addIssue({
        code: "custom",
        message: `A signup form must contain a required top-level "${name}" field`,
      });
    }
  }
});
