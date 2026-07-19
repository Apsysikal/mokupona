import { z } from "zod";

import { SignupFormBuilderSchema } from "~/features/signup-form/builder";
import { imageFileSchema } from "~/shared/image";

export const EventSchema = z.object({
  signupForm: SignupFormBuilderSchema,
  title: z.string({ error: "Title is required" }).trim(),
  description: z.string({ error: "Description is required" }).trim(),
  menuDescription: z.string().trim().optional(),
  donationDescription: z.string().trim().optional(),
  // `datetime-local` submits a wall-clock string without timezone info. It
  // stays a string here — coercing through `new Date()` would interpret it in
  // the runtime's local timezone, which is lossy inside that zone's DST
  // spring-forward gap; the server converts it with `toUtcEventDate`, which
  // owns the event-timezone semantics.
  date: z
    .string({ error: "Date is required" })
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/,
      "Date is required",
    )
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Date is required",
    ),
  slots: z
    .number({ error: "Slots is required" })
    .min(0, "Slots cannot be less than 0")
    .int(),
  price: z
    .number({ error: "Price is required" })
    .min(0, "Price cannot be less than 0")
    .int(),
  discounts: z.string().trim().optional(),
  cover: imageFileSchema(),
  addressId: z.string({ error: "Address is required" }).trim(),
});

export const EventEditSchema = EventSchema.partial({ cover: true });
