import { createLinkTargetRegistry } from "./link-targets";

export const siteLinkTargetRegistry = createLinkTargetRegistry([
  { key: "home", label: "Home", href: "/" },
  { key: "dinners", label: "Dinners", href: "/dinners" },
  { key: "join", label: "Join", href: "/join" },
]);
