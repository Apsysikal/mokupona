import type { Route } from "./+types/api.auth.$";

import { auth } from "~/features/auth/auth.server";

export const loader = async ({ request }: Route.LoaderArgs) =>
  auth.handler(request);

export const action = async ({ request }: Route.ActionArgs) =>
  auth.handler(request);
