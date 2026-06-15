import { prisma } from "~/db.server";

type SaveImageParams = {
  file: File;
  alt?: string;
  width?: number;
  height?: number;
};

export async function saveImage({ file, alt }: SaveImageParams) {
  return prisma.image.create({
    data: {
      altText: alt,
      contentType: file.type,
      blob: Buffer.from(await file.arrayBuffer()),
    },
  });
}
