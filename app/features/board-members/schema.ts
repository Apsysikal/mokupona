import { z } from "zod";

// Shared by the board-member new and edit routes: both validate the same
// fields and advertise the same accepted image types.

export const MemberSchema = z.object({
  name: z
    .string({ error: "You must enter a name for the board member" })
    .trim(),
  position: z
    .string({
      error: "You must enter a position for the board member",
    })
    .trim(),
  image: z
    .instanceof(File, { message: "You must select a file" })
    .optional()
    .refine((file) => {
      if (!file) return true;
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      if (!file) return true;
      return file.size <= 1024 * 1024 * 3;
    }, "File cannot be greater than 3MB"),
});

export const validImageTypes = ["image/jpeg", "image/png", "image/webp"];
