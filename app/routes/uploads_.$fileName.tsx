import type { LoaderArgs } from "@remix-run/node";
import invariant from "tiny-invariant";

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.fileName);
  const url = `${process.env.STRAPI_API_URL}/uploads/${params.fileName}`;
  return fetch(url);
};
