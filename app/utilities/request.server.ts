import { json } from "@remix-run/node";

export const badRequest = <T>(data: T) => {
  return json<T>(data, { status: 400 });
};
