import { z } from "zod";

export const EventSchema = z.object({
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
  cover: z
    .instanceof(File, { message: "You must select a file" })
    .refine((file) => {
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      return file.size <= 1024 * 1024 * 3;
    }, "File cannot be greater than 3MB"),
  addressId: z.string({ error: "Address is required" }).trim(),
});
