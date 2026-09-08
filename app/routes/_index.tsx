import type { Route } from "./+types/_index";

import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import {
  TitleCardBlockView,
  type TitleCardBlockType,
} from "~/features/cms/blocks/title-card";
import { LandingDinnersSection } from "~/features/events/components/landing-dinners-section";
import {
  orderEventsByStatus,
  partitionEvents,
} from "~/features/events/event-status";
import { toEventCardModel } from "~/features/events/view-models";
import { getEventsWithAddress } from "~/models/event.server";
import { getImageUrl } from "~/shared/image";
import { withOpenGraphUrls } from "~/shared/meta";
import { getImageConfig } from "~/shared/root-data";

const HERO_IMAGE_ID = "static/hero-image";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export const loader = async () => {
  const events = await getEventsWithAddress();

  return { events: events.map(toEventCardModel) };
};

const titleCardData: TitleCardBlockType = {
  type: "title-card",
  version: 1,
  data: {
    title: "moku pona",
    // hand-drawn wordmark; `title` above is its alt text
    logo: { src: "/naive-title.svg", width: 1258, height: 368 },
    tagline: "a dinner society in zürich",
    scrollTo: "#vision",
  },
};

const visionSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    eyebrow: "our vision",
    eyebrowHandwritten: "ourVision",
    headline: "food as a way to connect",
    body: "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. for us, food is a way to express creativity, share experiences, and connect with others. through our dinner club, we surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them.",
    variant: "plain",
  },
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

  const ogImageUrl = getImageUrl(
    { storageKey: HERO_IMAGE_ID },
    getImageConfig(matches),
    { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
  );

  return withOpenGraphUrls(tags, {
    matches,
    imagePath: ogImageUrl || undefined,
    pagePath: location.pathname,
  });
};

export default function Index({ loaderData }: Route.ComponentProps) {
  const { events } = loaderData;

  const now = new Date();
  const { upcoming, past } = partitionEvents(events, now);
  // every past dinner, newest first — the landing page no longer teases a
  // subset, so there is nothing left on /dinners that isn't already here
  const pastDinners = orderEventsByStatus(past, now);

  return (
    <main>
      <TitleCardBlockView blockData={titleCardData} />

      <TextSectionBlockView id="vision" blockData={visionSectionData} />

      <LandingDinnersSection upcoming={upcoming} past={pastDinners} />
    </main>
  );
}
