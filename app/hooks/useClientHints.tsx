import { useRouteLoaderData } from "react-router";

import type { RootLoaderData } from "~/root";

type ClientHints = Awaited<ReturnType<RootLoaderData>>["data"]["clientHints"];

export function useClientHints(): ClientHints {
  const { clientHints } = useRouteLoaderData("root");
  if (!clientHints) throw "You must return 'clientHints' in your root loader";
  return clientHints;
}
