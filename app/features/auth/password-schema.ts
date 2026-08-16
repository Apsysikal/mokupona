import { z } from "zod";

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
        const pair = value as { password: string; confirmPassword: string };
        return pair.password === pair.confirmPassword;
      },
      { message: "passwords must match.", path: ["confirmPassword"] },
    );
}
