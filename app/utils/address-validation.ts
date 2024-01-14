import { z } from "zod";

export const AddressSchema = z.object({
  streetName: z.string({ required_error: "Street Name is required" }).trim(),
  houseNumber: z.string({ required_error: "House Number is required" }).trim(),
  zipCode: z.string({ required_error: "Zip Code is required" }).trim(),
  city: z.string({ required_error: "City is required" }).trim(),
});
