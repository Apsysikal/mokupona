import type { MetaFunction } from "react-router";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";
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

const heroSectionData: HeroBlock = {
  type: "hero",
  title: "moku pona",
  body: "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
  actions: [{ href: "/dinners", label: "join a dinner" }],
  media: {
    src: "/landing-page-default.jpg",
    srcSet:
      "/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w",
  },
};

const visionSectionData: TextSectionBlock = {
  heading: "our vision",
  body: "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. For us, food is a way to express creativity, share experiences, and connect with others. Through our dinner club, we aim to surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them. At its heart, moku pona is about celebrating the art of food and inspiring curiosity about global food cultures.",
};

const imageSectionData: ImageSectionBlock = {
  src: "/accent-image.png",
  srcSet:
    "/accent-image-sm.webp 432w, /accent-image-md.webp 648w, /accent-image-lg.webp 864w, /accent-image-original.webp 1080w",
  alt: "",
};

const differenceSectionData: TextSectionBlock = {
  heading: "how's this different?",
  body: "At moku pona, we believe that food is a powerful way to bring people together. Our dinner events go beyond the typical restaurant experience, creating a warm and welcoming community space where friends and strangers can forge new connections. We aim to make every gathering an opportunity not just to enjoy a wonderful meal, but also to meet new people, share stories, and build meaningful relationships. It's a place to connect, learn, and experience the magic of a shared table in a cozy, intimate setting.",
};

const aboutSectionData: SlantedTextSectionBlock = {
  heading: "who we are",
  body: "Learn more about the people behind moku pona here.",
  actions: [{ href: "/about", label: "meet the team" }],
};

export default function Index() {
  return (
    <main>
      <Hero data={heroSectionData} />

      <div className="h-20" />

      <TextSection data={visionSectionData} />

      <ImageSection data={imageSectionData} />

      <TextSection data={differenceSectionData} />

      <SlantedTextSection data={aboutSectionData} />
    </main>
  );
}

type HeroBlock = {
  type: "hero";
  title: string;
  body: string;
  actions: { href: string; label: string }[];
  media: {
    src: string;
    srcSet?: string;
    alt?: string;
  };
  align?: "left" | "right";
  theme?: "light" | "dark";
};

function Hero({ data }: { data: HeroBlock }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute top-20 left-[calc(20%-20rem)] -z-10 transform-gpu blur-3xl not-lg:left-[calc(20%-30rem)]"
      >
        <div
          style={{
            clipPath:
              "polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)",
          }}
          className="aspect-2/1 w-200 bg-linear-to-r from-orange-400 to-red-800 opacity-40"
        />
      </div>

      <div className="mx-auto mt-20 max-w-4xl md:flex">
        <div className="flex shrink-0 flex-col justify-center gap-10 px-4 md:max-w-md lg:max-w-lg">
          <h1 className="text-foreground text-5xl">{data.title}</h1>
          <p className="text-foreground text-2xl font-thin text-balance">
            {data.body}
          </p>

          {data.actions.length > 0 ? (
            <div className="flex gap-4">
              {data.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={index > 0 ? "link" : "default"}
                  asChild
                >
                  <Link to={action.href} className="lowercase">
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mx-auto flex not-lg:mt-10">
          <div className="max-w-3xl flex-none not-md:pl-4 md:max-w-3xl lg:max-w-4xl 2xl:max-w-none">
            <picture>
              <img
                srcSet={data.media.srcSet}
                src={data.media.src}
                className="w-304 rounded-md object-center"
                fetchPriority="high"
                alt={data.media.alt}
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
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

type TextSectionBlock = {
  heading: string;
  body: string;
  actions?: [];
  theme?: "light" | "dark";
};

function TextSection({ data }: { data: TextSectionBlock }) {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-10 px-4">
      <h2 className="text-4xl">{data.heading}</h2>
      <p className="text-xl leading-relaxed font-light">{data.body}</p>
    </section>
  );
}

type ImageSectionBlock = {
  src: string;
  srcSet?: string;
  alt?: string;
  theme?: "light" | "dark";
};

function ImageSection({ data }: { data: ImageSectionBlock }) {
  return (
    <picture>
      <img
        srcSet={data.srcSet}
        src={data.src}
        className="my-20 h-96 w-full justify-end object-cover"
        alt={data.alt}
      />
    </picture>
  );
}

type SlantedTextSectionBlock = {
  heading: string;
  body: string;
  actions?: { href: string; label: string }[];
  theme?: "light" | "dark";
};

function SlantedTextSection({ data }: { data: SlantedTextSectionBlock }) {
  return (
    <div className="text-background relative my-20 w-full py-10">
      <div className="after:bg-accent mx-auto flex max-w-4xl flex-col gap-2 px-4 after:absolute after:inset-0 after:-z-10 after:skew-y-3">
        <section className="my-5 grid max-w-4xl grid-cols-5 gap-5">
          <h2 className="col-span-full text-4xl">{data.heading}</h2>

          <p className="col-span-full my-auto text-xl leading-relaxed font-thin">
            {data.body}
          </p>

          {data.actions?.length ? (
            <div className="col-span-full flex items-center gap-4">
              {data.actions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="bg-accent border-background hover:bg-background/5 text-background"
                  asChild
                >
                  <Link to={action.href}>{action.label}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
