import { z } from "zod";

import { SignupFormBuilderSchema } from "~/features/signup-form/builder";
import { imageFileSchema } from "~/shared/image";

export const EventSchema = z.object({
  signupForm: SignupFormBuilderSchema,
  title: z.string({ error: "Title is required" }).trim(),
  description: z.string({ error: "Description is required" }).trim(),
  menuDescription: z.string().trim().optional(),
  donationDescription: z.string().trim().optional(),
  date: z.coerce.date({ error: "Date is required" }),
  slots: z
    .number({ error: "Slots is required" })
    .min(0, "Slots cannot be less than 0")
    .int(),
  price: z
    .number({ error: "Price is required" })
    .min(0, "Price cannot be less than 0")
    .int(),
  discounts: z.string().trim().optional(),
  cover: imageFileSchema(1024 * 1024 * 3),
  addressId: z.string({ error: "Address is required" }).trim(),
});
