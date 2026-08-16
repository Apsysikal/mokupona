import type { Route } from "./+types/_index";

import { HeroBlockView } from "~/features/cms/blocks/hero";
import type { HeroBlockType } from "~/features/cms/blocks/hero/model";
import type { ImageBlockType } from "~/features/cms/blocks/image/model";
import { ImageBlockView } from "~/features/cms/blocks/image/view";
import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import { formatEventDayMonth } from "~/features/events/date-format";
import { getBlurDataUrl } from "~/features/images/blur-placeholder.server";
import { getNextEvent } from "~/models/event.server";
import { withOpenGraphUrls } from "~/shared/meta";

const HERO_IMAGE_ID = "static/hero-image";
const ACCENT_IMAGE_ID = "static/accent-image";

export const loader = async () => {
  const [nextEvent, heroBlurDataUrl, accentBlurDataUrl] = await Promise.all([
    getNextEvent(),
    getBlurDataUrl(HERO_IMAGE_ID),
    getBlurDataUrl(ACCENT_IMAGE_ID),
  ]);

  return {
    nextDinner: nextEvent
      ? { id: nextEvent.id, date: nextEvent.date, slots: nextEvent.slots }
      : null,
    heroBlurDataUrl,
    accentBlurDataUrl,
  };
};

export const meta: Route.MetaFunction = ({ matches, location }) => {
  const metaTags = [
    { title: "moku pona" },
    {
      name: "description",
      content:
        "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
    },
  ] satisfies ReturnType<Route.MetaFunction>;

  const tags = [
    ...metaTags,
    { property: "og:title", content: metaTags[0].title },
    { property: "og:type", content: "website" },
  ];

  return withOpenGraphUrls(tags, {
    matches,
    imagePath: "/landing-page-default.jpg",
    pagePath: location.pathname,
  });
};

const visionSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    eyebrow: "our vision",
    headline: "food as a way to connect",
    body: "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. for us, food is a way to express creativity, share experiences, and connect with others. through our dinner club, we surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them.",
    variant: "plain",
  },
};

const accentSectionData = (blurDataUrl: string | null): ImageBlockType => ({
  type: "image",
  version: 1,
  data: {
    image: {
      src: ACCENT_IMAGE_ID,
      alt: "",
      width: 1080,
      height: 382,
      blurDataUrl,
    },
    variant: "full-width",
  },
});

const differenceSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    eyebrow: "how's this different?",
    headline: "more than a meal out",
    body: "our dinner events go beyond the typical restaurant experience, creating a warm and welcoming space where friends and strangers can forge new connections. every gathering is a chance not just to enjoy a wonderful meal, but to meet new people, share stories, and build meaningful relationships, the magic of a shared table in a cozy, intimate setting.",
    variant: "plain",
  },
};

const aboutSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    eyebrow: "who we are",
    headline: "a community of around fifteen",
    body: "what started as a shared love of cooking has grown into a community who come together to create, host, and share meals. as an association, moku pona is about community, creativity, and hospitality, not just dining, but making people feel welcome.",
    variant: "slanted",
  },
};

export default function Index({ loaderData }: Route.ComponentProps) {
  const { nextDinner, heroBlurDataUrl, accentBlurDataUrl } = loaderData;

  const heroSectionData: HeroBlockType = {
    type: "hero",
    version: 1,
    data: {
      eyebrow: nextDinner
        ? `next gathering · ${formatEventDayMonth(new Date(nextDinner.date))}`
        : undefined,
      headline: "an evening around",
      headlineAccent: "one long table",
      description:
        "moku pona is a dinner society in zürich, shared meals, new stories, and the quiet joy of discovery.",
      actions: [
        {
          href: nextDinner ? `/dinners/${nextDinner.id}` : "/dinners",
          label: "reserve a seat",
        },
        { href: "/dinners", label: "see all dinners →", variant: "secondary" },
      ],
      meta: undefined,
      image: {
        src: HERO_IMAGE_ID,
        alt: "",
        width: 1080,
        height: 572,
        blurDataUrl: heroBlurDataUrl,
      },
    },
  };

  return (
    <main>
      <HeroBlockView blockData={heroSectionData} />

      <TextSectionBlockView blockData={visionSectionData} />

      <ImageBlockView blockData={accentSectionData(accentBlurDataUrl)} />

      <TextSectionBlockView blockData={differenceSectionData} />

      <TextSectionBlockView blockData={aboutSectionData} />
    </main>
  );
}
