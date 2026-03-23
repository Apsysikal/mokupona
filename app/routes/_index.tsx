import type { MetaFunction } from "react-router";

import { HeroBlockView } from "~/features/cms/blocks/hero";
import type { HeroBlockType } from "~/features/cms/blocks/hero/model";
import type { ImageBlockType } from "~/features/cms/blocks/image/model";
import { ImageBlockView } from "~/features/cms/blocks/image/view";
import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import type { RootLoaderData } from "~/root";

export const meta: MetaFunction<null, { root: RootLoaderData }> = ({
  matches,
  location,
}) => {
  const metaTags = [
    { title: "moku pona" },
    {
      name: "description",
      content:
        "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
    },
  ] satisfies ReturnType<MetaFunction>;

  const domainUrl = matches.find(({ id }) => id === "root")?.data.domainUrl;
  if (!domainUrl) return metaTags;

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

const heroSectionData: HeroBlockType = {
  type: "hero",
  version: 1,
  data: {
    eyebrow: "our next event is on may 9th",
    headline: "moku pona",
    description:
      "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
    actions: [{ href: "/dinners", label: "join a dinner" }],
    image: {
      src: "/hero-image.jpg",
    },
  },
};

const visionSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    headline: "our vision",
    body: "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. For us, food is a way to express creativity, share experiences, and connect with others. Through our dinner club, we aim to surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them. At its heart, moku pona is about celebrating the art of food and inspiring curiosity about global food cultures.",
    variant: "plain",
  },
};

const imageSectionData: ImageBlockType = {
  type: "image",
  version: 1,
  data: {
    image: {
      src: "/accent-image.png",
      alt: "",
    },
    variant: "full-width",
  },
};

const differenceSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    headline: "how's this different?",
    body: "At moku pona, we believe that food is a powerful way to bring people together. Our dinner events go beyond the typical restaurant experience, creating a warm and welcoming community space where friends and strangers can forge new connections. We aim to make every gathering an opportunity not just to enjoy a wonderful meal, but also to meet new people, share stories, and build meaningful relationships. It's a place to connect, learn, and experience the magic of a shared table in a cozy, intimate setting.",
    variant: "plain",
  },
};

const aboutSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    headline: "who we are",
    body: "What started as a shared love of cooking has grown into a community of around 15 members who come together to create, host, and share meals. We see food as a way to bring people together: to exchange ideas, build friendships, and create meaningful experiences around the table. As an association, moku pona is about community, creativity, and hospitality - not just dining, but making people feel welcome.",
    variant: "slanted",
  },
};

export default function Index() {
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

type SplitSectionMediaBlock = {
  heading: string;
  body: string;
  media: {
    src: string;
    srcSet?: string;
    alt?: string;
  };
  mediaPosition?: "left" | "right";
  actions?: { href: string; label: string }[];
  variant?: "default" | "alternate";
  theme?: "light" | "dark";
};

function SplitSectionMedia() {
  const data: SplitSectionMediaBlock = {
    heading: "our vision",
    body: "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. For us, food is a way to express creativity, share experiences, and connect with others. Through our dinner club, we aim to surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them. At its heart, moku pona is about celebrating the art of food and inspiring curiosity about global food cultures.",
    media: {
      src: "/vision-image.jpg",
      srcSet:
        "/vision-image-sm.webp 432w, /vision-image-md.webp 648w, /vision-image-lg.webp 864w, /vision-image-original.webp 1080w",
      alt: "Our vision image",
    },
    mediaPosition: "right",
    actions: [],
    variant: "default",
  };

  const content = (
    <div className="flex flex-col gap-10">
      <h2 className="text-4xl">{data.heading}</h2>
      <p className="text-xl leading-relaxed font-light">{data.body}</p>
    </div>
  );

  const media = (
    <picture>
      <img
        srcSet={data.media.srcSet}
        src={data.media.src}
        className="aspect-square h-full w-full rounded-md object-cover"
        alt={data.media.alt}
      />
    </picture>
  );

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-6 gap-5 border border-solid border-red-500">
      {/* Left block */}
      <div className="col-span-3 border border-solid border-blue-500">
        {data.mediaPosition === "left" ? media : content}
      </div>

      {/* Right block */}
      <div className="col-span-3 border border-solid border-green-500">
        {data.mediaPosition === "right" ? media : content}
      </div>
    </div>
  );
}
