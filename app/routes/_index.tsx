import type { Route } from "./+types/_index";

import { HeroBlockView } from "~/features/cms/blocks/hero";
import type { HeroBlockType } from "~/features/cms/blocks/hero/model";
import type { ImageBlockType } from "~/features/cms/blocks/image/model";
import { ImageBlockView } from "~/features/cms/blocks/image/view";
import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import { getNextEvent } from "~/models/event.server";
import { formatEventDayMonth } from "~/utils/misc";

export const loader = async () => {
  const nextEvent = await getNextEvent();

  return {
    nextDinner: nextEvent
      ? { id: nextEvent.id, date: nextEvent.date, slots: nextEvent.slots }
      : null,
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

  const domainUrl = matches[0].loaderData.domainUrl;

  const imageUrl = new URL("/landing-page-default.jpg", domainUrl);
  const currentUrl = new URL(location.pathname, domainUrl);

  return [
    ...metaTags,
    { property: "og:title", content: metaTags[0].title },
    { property: "og:type", content: "website" },
    { property: "og:image", content: imageUrl },
    { property: "og:url", content: currentUrl },
  ];
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

const imageSectionData: ImageBlockType = {
  type: "image",
  version: 1,
  data: {
    image: {
      src: "/accent-image.jpg",
      alt: "",
    },
    variant: "full-width",
  },
};

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
  const { nextDinner } = loaderData;

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
      meta: nextDinner ? `${nextDinner.slots} seats · zürich` : "zürich",
      image: {
        src: "/hero-image.jpg",
        alt: "",
      },
    },
  };

  return (
    <main>
      <HeroBlockView blockData={heroSectionData} />

      <TextSectionBlockView blockData={visionSectionData} />

      <ImageBlockView blockData={imageSectionData} />

      <TextSectionBlockView blockData={differenceSectionData} />

      <TextSectionBlockView blockData={aboutSectionData} />
    </main>
  );
}
