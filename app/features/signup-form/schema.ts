import { FormSchema } from "~/features/forms/fields";

// Profile ceiling for the friends list; independent of the generic
// MAX_LIST_COUNT so raising the generic bound for other form kinds never
// loosens the public signup endpoint.
export const MAX_FRIENDS_COUNT = 10;

// Exported so the builder UI derives its pinned rows from the same list the
// profile validates against.
export const FIXED_IDENTITY_FIELDS = [
  { name: "name", type: "text" },
  { name: "email", type: "email" },
  { name: "phone", type: "phone" },
] as const;

// The signup form profile: generic FormSchema plus the conventions the signup
// consumers rely on.
export const SignupFormSchema = FormSchema.superRefine((fields, ctx) => {
  const lists = fields.filter((field) => field.type === "list");
  if (lists.length !== 1 || lists[0].data.name !== "friends") {
    ctx.addIssue({
      code: "custom",
      message: 'A signup form must contain exactly one list named "friends"',
    });
  }
  for (const list of lists) {
    if (list.data.maxCount > MAX_FRIENDS_COUNT) {
      ctx.addIssue({
        code: "custom",
        message: `The friends list allows at most ${MAX_FRIENDS_COUNT} entries`,
      });
    }
  }

  for (const { name, type } of FIXED_IDENTITY_FIELDS) {
    const field = fields.find(
      (candidate) => candidate.type !== "list" && candidate.data.name === name,
    );
    if (!field || field.type !== type || !field.data.required) {
      ctx.addIssue({
        code: "custom",
        message: `A signup form must contain a required top-level "${name}" field of type "${type}"`,
      });
    }
  }
});
