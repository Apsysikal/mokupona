import { createCmsPageService } from "./page-service.server";
import { createPrismaCmsPageStore } from "./page-store.server";
import { siteCmsCatalog } from "./site-catalog";

export const siteCmsPageService = createCmsPageService({
  catalog: siteCmsCatalog,
  pageStore: createPrismaCmsPageStore(),
});
