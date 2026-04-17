import type { PageStatus } from "./page-status";
import {
  cmsDiagnosticCodes,
  isAdminOnlyBlockDiagnosticCode,
  type CmsDiagnostic,
} from "./diagnostics";

const defaultBackedBanner =
  "This page is still using code defaults. Your first successful save will materialize persisted CMS content.";
const recoverableBlocksBanner =
  "Persisted content includes unsupported or broken blocks. They remain visible here for recovery.";
const publicFallbackBanner =
  "Public rendering recovered to defaults because persisted structure is invalid. Fix persisted blocks to heal the page.";

export function derivePageBanners(input: {
  status: PageStatus;
  diagnostics: readonly CmsDiagnostic[];
}): readonly string[] {
  const hasFallbackRecovery = input.diagnostics.some(
    ({ code }) => code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
  );
  const hasRecoverableBlocks = input.diagnostics.some(({ code }) =>
    isAdminOnlyBlockDiagnosticCode(code),
  );

  const banners: string[] = [];
  if (input.status.kind === "default-backed") {
    banners.push(defaultBackedBanner);
  }
  if (hasRecoverableBlocks) {
    banners.push(recoverableBlocksBanner);
  }
  if (hasFallbackRecovery) {
    banners.push(publicFallbackBanner);
  }

  return banners;
}
