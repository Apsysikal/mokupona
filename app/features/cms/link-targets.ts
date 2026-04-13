export type LinkTargetKey = string;

export type LinkTarget = {
  key: LinkTargetKey;
  label: string;
  href: string;
  external?: boolean;
};

export type LinkTargetRegistry = {
  readonly targets: readonly LinkTarget[];
  readonly byHref: Readonly<Record<string, LinkTarget>>;
};

export function createLinkTargetRegistry(
  targets: readonly LinkTarget[],
): LinkTargetRegistry {
  const byHref: Record<string, LinkTarget> = {};
  for (const target of targets) {
    byHref[target.href] = target;
  }
  return { targets, byHref };
}
