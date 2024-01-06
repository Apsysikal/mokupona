import { readFile } from "fs/promises";
import path from "node:path";

import { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";

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
  const file = await readFile(filePath);

  let contentType = "";

  switch (extension) {
    case ".jpg":
      contentType = "image/jpeg";
      break;

    case ".jpeg":
      contentType = "image/jpeg";
      break;

    case ".png":
      contentType = "image/png";
      break;

    case ".webp":
      contentType = "image/webp";
      break;

    default:
      throw new Response("Not found", { status: 404 });
  }

  return new Response(file.buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": Buffer.byteLength(file.buffer).toString(),
      "Content-Disposition": `inline; filename="${params.imageId}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
