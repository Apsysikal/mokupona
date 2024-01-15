import { readFile } from "fs/promises";
import path from "node:path";

import { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";

import { prisma } from "~/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { fileId } = params;
  const fileFolder = process.env.IMAGE_UPLOAD_FOLDER;

  invariant(
    typeof fileFolder === "string",
    "Variable IMAGE_UPLOAD_FOLDER must be set",
  );
  invariant(typeof fileId === "string", "Parameter fileId must be provided");

  const filePath = path.join(fileFolder, fileId);
  const extension = await path.extname(filePath);
  let file = null;
  let content = null;

  let contentType = "";
  let contentLength = "";

  switch (extension) {
    case ".jpg":
      file = await readFile(filePath);
      contentType = "image/jpeg";
      contentLength = Buffer.byteLength(file.buffer).toString();
      content = file.buffer;
      break;

    case ".jpeg":
      file = await readFile(filePath);
      contentType = "image/jpeg";
      contentLength = Buffer.byteLength(file.buffer).toString();
      content = file.buffer;
      break;

    case ".png":
      file = await readFile(filePath);
      contentType = "image/png";
      contentLength = Buffer.byteLength(file.buffer).toString();
      content = file.buffer;
      break;

    case ".webp":
      file = await readFile(filePath);
      contentType = "image/webp";
      contentLength = Buffer.byteLength(file.buffer).toString();
      content = file.buffer;
      break;

    case "":
      // No extension. Look in the database
      file = await prisma.eventImage.findUnique({ where: { id: fileId } });
      if (!file) throw new Response("Not found", { status: 404 });
      contentType = file.contentType;
      contentLength = file.blob.byteLength.toString();
      content = file.blob;
      break;

    default:
      throw new Response("Not found", { status: 404 });
  }

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": contentLength,
      "Content-Disposition": `inline; filename="${params.imageId}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
