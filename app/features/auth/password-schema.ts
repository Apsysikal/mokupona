import { z } from "zod";

// Single source of truth for password rules across join, invite signup,
// reset and the /me forms. The max mirrors better-auth's built-in 128-char
// limit — without it signUpEmail/setPassword throw PASSWORD_TOO_LONG after
// zod has already passed, surfacing as a 500 instead of a field error.
export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "password must be at least 8 characters.")
  .max(128, "password must be at most 128 characters.");

export function withPasswordConfirmation<Shape extends z.ZodRawShape>(
  shape: Shape,
) {
  return z
    .object({
      ...shape,
      password: passwordSchema,
      confirmPassword: z.string({ error: "Please confirm your password" }),
    })
    .refine(
      (value) => {
        // TS can't resolve the pair's keys through the generic spread
        const pair = value as { password: string; confirmPassword: string };
        return pair.password === pair.confirmPassword;
      },
      { message: "passwords must match.", path: ["confirmPassword"] },
    );
}
