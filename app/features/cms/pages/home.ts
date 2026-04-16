import type { MetaDescriptor } from "react-router";

import type { HeroBlockType } from "../blocks/hero";
import type { ImageBlockType } from "../blocks/image";
import type { CmsBlock } from "../blocks/registry";
import type { TextSectionBlockType } from "../blocks/text-section";
import { definePageDefinition } from "../catalog";

type HomePageMetaInput = {
  domainUrl?: string;
  pathname: string;
};

const DEFAULT_HOME_PAGE_DESCRIPTION =
  "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.";
const HOME_PAGE_TITLE = "moku pona";

const homeHeroBlock: HeroBlockType = {
  definitionKey: "hero-main",
  type: "hero",
  version: 1,
  data: {
    eyebrow: "our next event is on may 9th",
    headline: "moku pona",
    description: DEFAULT_HOME_PAGE_DESCRIPTION,
    actions: [{ href: "/dinners", label: "join a dinner" }],
    image: {
      kind: "asset",
      src: "/hero-image.jpg",
    },
  },
};

const homeVisionBlock: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    headline: "our vision",
    body: "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. For us, food is a way to express creativity, share experiences, and connect with others. Through our dinner club, we aim to surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them. At its heart, moku pona is about celebrating the art of food and inspiring curiosity about global food cultures.",
    variant: "plain",
  },
};

const homeImageBlock: ImageBlockType = {
  type: "image",
  version: 1,
  data: {
    image: {
      kind: "asset",
      src: "/accent-image.png",
      alt: "",
    },
    variant: "full-width",
  },
};

const homeDifferenceBlock: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    headline: "how's this different?",
    body: "At moku pona, we believe that food is a powerful way to bring people together. Our dinner events go beyond the typical restaurant experience, creating a warm and welcoming community space where friends and strangers can forge new connections. We aim to make every gathering an opportunity not just to enjoy a wonderful meal, but also to meet new people, share stories, and build meaningful relationships. It's a place to connect, learn, and experience the magic of a shared table in a cozy, intimate setting.",
    variant: "plain",
  },
};

const homeAboutBlock: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    headline: "who we are",
    body: "What started as a shared love of cooking has grown into a community of around 15 members who come together to create, host, and share meals. We see food as a way to bring people together: to exchange ideas, build friendships, and create meaningful experiences around the table. As an association, moku pona is about community, creativity, and hospitality - not just dining, but making people feel welcome.",
    variant: "slanted",
  },
};

export const homePageBlocks: readonly CmsBlock[] = [
  homeHeroBlock,
  homeVisionBlock,
  homeImageBlock,
  homeDifferenceBlock,
  homeAboutBlock,
];

export function getHomePageMeta({
  domainUrl,
  pathname,
}: HomePageMetaInput): MetaDescriptor[] {
  const metaTags: MetaDescriptor[] = [
    { title: HOME_PAGE_TITLE },
    {
      name: "description",
      content: DEFAULT_HOME_PAGE_DESCRIPTION,
    },
  ];

  if (!domainUrl) return metaTags;

  const imageUrl = new URL("/landing-page-default.jpg", domainUrl);
  const currentUrl = new URL(pathname, domainUrl);

  return [
    ...metaTags,
    { property: "og:title", content: HOME_PAGE_TITLE },
    { property: "og:type", content: "website" },
    { property: "og:image", content: imageUrl.toString() },
    { property: "og:url", content: currentUrl.toString() },
  ];
}

export const homePageDefinition = definePageDefinition({
  pageKey: "home",
  defaults: {
    title: HOME_PAGE_TITLE,
    description: DEFAULT_HOME_PAGE_DESCRIPTION,
    shareImageSrc: "/landing-page-default.jpg",
    blocks: [...homePageBlocks],
  },
  rules: {
    allowedBlockTypes: ["hero", "text-section", "image"],
    requiredLeadingBlockTypes: ["hero"],
  },
});
