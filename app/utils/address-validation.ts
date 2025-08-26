import { z } from "zod";

export const AddressSchema = z.object({
  streetName: z.string({ error: "Street Name is required" }).trim(),
  houseNumber: z.string({ error: "House Number is required" }).trim(),
  zipCode: z.string({ error: "Zip Code is required" }).trim(),
  city: z.string({ error: "City is required" }).trim(),
});
