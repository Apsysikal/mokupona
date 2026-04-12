import type { MetaFunction } from "react-router";

import { PublicPageRenderer } from "~/features/cms/public-page-renderer";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import type { RootLoaderData } from "~/root";

export const meta: MetaFunction<null, { root: RootLoaderData }> = ({
  matches,
  location,
}) => {
  const domainUrl = matches.find(({ id }) => id === "root")?.data.domainUrl;
  return siteCmsCatalog.projectPublic("home", {
    domainUrl,
    pathname: location.pathname,
  }).meta;
};

export default function Index() {
  const projection = siteCmsCatalog.projectPublic("home", { pathname: "/" });

  return (
    <PublicPageRenderer catalog={siteCmsCatalog} projection={projection} />
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
