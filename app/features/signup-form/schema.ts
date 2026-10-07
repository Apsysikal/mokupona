import { FormSchema } from "~/features/forms/fields";

export const MAX_FRIENDS_COUNT = 10;

export const FIXED_IDENTITY_FIELDS = [
  { name: "name", type: "text" },
  { name: "email", type: "email" },
  { name: "phone", type: "phone" },
] as const;

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
