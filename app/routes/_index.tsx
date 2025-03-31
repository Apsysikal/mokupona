import Autoplay from "embla-carousel-autoplay";
import type { MetaFunction } from "react-router";
import { Link } from "react-router";

import { Arrow } from "~/components/arrow";
import {
  CoffeeIllustration,
  FruitDrinkIllustration,
} from "~/components/illustrations";
import { Button } from "~/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
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

export default function Index() {
  return (
    <main>
      <div className="mx-auto mt-20 max-w-4xl">
        <div className="mx-2 grid grid-cols-5 gap-20">
          <div className="col-span-full max-md:overflow-hidden md:col-span-3">
            <picture>
              <img
                srcSet="/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w"
                src="/landing-page-default.jpg"
                className="aspect-video h-full w-full justify-end rounded-2xl object-cover"
                fetchPriority="high"
                alt=""
              />
            </picture>
          </div>

          <div className="col-span-full flex flex-col justify-center gap-8 py-2 md:col-span-2">
            <h1 className="text-5xl text-gray-50 lowercase">moku pona</h1>

            <p className="text-2xl leading-normal font-thin text-balance">
              A dinner society in Zurich, bringing people together through
              shared meals, stories, and the joy of discovery.
            </p>

            <Button asChild size="lg">
              <Link to="/dinners" className="w-fit">
                join a dinner
              </Link>
            </Button>
          </div>

          <Link
            to="#vision"
            className="text-accent col-span-full mx-auto"
            aria-label="Scroll to vision"
          >
            <Arrow orientation="down" />
          </Link>
        </div>
      </div>

      <div
        id="vision"
        className="mx-auto mt-16 flex max-w-4xl scroll-m-10 flex-col gap-2 px-2"
      >
        <section className="my-5 grid max-w-4xl grid-cols-5 gap-10">
          <h2 className="col-span-full text-4xl">our vision</h2>
          <p className="col-span-full flex items-center gap-10 text-xl leading-relaxed font-light">
            moku pona began as a passion project by a group of friends who love
            cooking and wanted a creative way to explore our culinary interests.
            For us, food is a way to express creativity, share experiences, and
            connect with others. Through our dinner club, we aim to surprise our
            guests with unique flavors and ingredients, introducing them to
            diverse cuisines and the stories behind them. At its heart, moku
            pona is about celebrating the art of food and inspiring curiosity
            about global food cultures.
            <span className="-mt-32 w-72 shrink-0 max-md:hidden">
              <FruitDrinkIllustration className="h-full w-full" />
            </span>
          </p>
        </section>
      </div>

      <picture>
        <img
          srcSet="/accent-image-sm.webp 432w, /accent-image-md.webp 648w, /accent-image-lg.webp 864w, /accent-image-original.webp 1080w"
          src="/accent-image.png"
          className="my-40 h-96 w-full justify-end object-cover max-md:my-20 max-md:h-48"
          alt=""
        />
      </picture>

      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-2">
        <section className="my-5 grid max-w-4xl grid-cols-5 gap-10">
          <h2 className="col-span-full flex items-end justify-between gap-10 text-4xl max-md:flex-col max-md:items-start">
            how&apos;s this different?
            <span className="w-80 shrink-0">
              <CoffeeIllustration className="h-full w-full" />
            </span>
          </h2>
          <p className="col-span-full text-xl leading-relaxed font-thin">
            At moku pona, we believe that food is a powerful way to bring people
            together. Our dinner events go beyond the typical restaurant
            experience, creating a warm and welcoming community space where
            friends and strangers can forge new connections. We aim to make
            every gathering an opportunity not just to enjoy a wonderful meal,
            but also to meet new people, share stories, and build meaningful
            relationships. It&apos;s a place to connect, learn, and experience
            the magic of a shared table in a cozy, intimate setting.
          </p>
        </section>
      </div>

      <div className="text-background relative mt-32 w-full py-4">
        <div className="after:bg-accent mx-auto flex max-w-4xl flex-col gap-2 px-2 after:absolute after:inset-0 after:-z-10 after:skew-y-3">
          <section className="my-5 grid max-w-4xl grid-cols-5 gap-5">
            <h2 className="col-span-full text-4xl">who we are</h2>

            <p className="col-span-2 my-auto text-xl leading-relaxed font-thin max-md:col-span-full">
              Learn more about the people behind moku pona here.
            </p>

            {/* <div className="col-span-3 flex items-center justify-end self-center max-md:col-span-full max-md:items-start max-md:justify-start">
              {[0, 1, 2].map((_, index) => {
                const offset = -1.5 * index;

                return (
                  <picture key={`portrait-${index}`}>
                    <img
                      // srcSet="/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w"
                      src={`/portraits/portrait-${index}.jpg`}
                      className={cn(
                        "h-40 w-40 translate-x-1 rounded-full border-2 border-accent object-cover max-md:h-28 max-md:w-28",
                      )}
                      style={{
                        transform: `translate(${offset}rem)`,
                      }}
                      alt=""
                    />
                  </picture>
                );
              })}
            </div> */}

            <Link
              to="/about"
              className="text-background col-span-full flex items-center gap-4"
              aria-label="Go to about page"
            >
              <Arrow className="shrink-0" />
            </Link>
          </section>
        </div>
      </div>

      <div className="mx-auto mt-32 max-w-4xl">
        <section className="flex flex-col gap-5">
          <h2 className="text-4xl">impressions</h2>

          <p className="text-xl leading-relaxed font-thin">
            If you have never been to any of our events, here are a few
            impressions.
          </p>

          <Carousel
            opts={{ loop: true }}
            plugins={[
              Autoplay({
                delay: 4000,
              }),
            ]}
            className="relative"
          >
            <CarouselContent>
              <CarouselItem className="lg:basis-2/3">
                <picture>
                  <img
                    srcSet="/accent-image-sm.webp 432w, /accent-image-md.webp 648w, /accent-image-lg.webp 864w, /accent-image-original.webp 1080w"
                    src="/accent-image.png"
                    className="h-48 w-full object-cover lg:h-96"
                    alt=""
                    loading="lazy"
                  />
                </picture>
              </CarouselItem>

              <CarouselItem className="lg:basis-2/3">
                <picture>
                  <img
                    srcSet="/accent-image-sm.webp 432w, /accent-image-md.webp 648w, /accent-image-lg.webp 864w, /accent-image-original.webp 1080w"
                    src="/accent-image.png"
                    className="h-48 w-full object-cover lg:h-96"
                    alt=""
                    loading="lazy"
                  />
                </picture>
              </CarouselItem>

              <CarouselItem className="lg:basis-2/3">
                <picture>
                  <img
                    srcSet="/accent-image-sm.webp 432w, /accent-image-md.webp 648w, /accent-image-lg.webp 864w, /accent-image-original.webp 1080w"
                    src="/accent-image.png"
                    className="h-48 w-full object-cover lg:h-96"
                    alt=""
                    loading="lazy"
                  />
                </picture>
              </CarouselItem>
            </CarouselContent>

            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>
      </div>
    </main>
  );
}
