import { z } from "zod";

import { imageFileSchema } from "~/shared/image";

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
  image: imageFileSchema(1024 * 1024 * 3).optional(),
});
