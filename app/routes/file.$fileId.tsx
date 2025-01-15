import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import { prisma } from "~/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { fileId } = params;

  invariant(typeof fileId === "string", "Parameter fileId must be provided");

  const file = await prisma.eventImage.findUnique({ where: { id: fileId } });
  if (!file) throw new Response("Not found", { status: 404 });
  const contentType = file.contentType;
  const contentLength = file.blob.byteLength.toString();

  return new Response(file.blob, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": contentLength,
      "Content-Disposition": `inline; filename="${params.imageId}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
