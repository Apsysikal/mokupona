import { createCmsEditorWorkflow } from "./editor-workflow.server";
import { siteCmsCatalog } from "./site-catalog";
import { siteLinkTargetRegistry } from "./site-link-targets";
import { siteCmsPageService } from "./site-page-service.server";

import { prisma } from "~/db.server";

export const siteCmsEditorWorkflow = createCmsEditorWorkflow({
  pageService: siteCmsPageService,
  catalog: siteCmsCatalog,
  linkTargets: siteLinkTargetRegistry,
  prisma,
});
