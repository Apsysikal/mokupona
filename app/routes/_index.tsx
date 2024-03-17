import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { Arrow } from "~/components/arrow";
import {
  CoffeeIllustration,
  FruitDrinkIllustration,
} from "~/components/illustrations";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  {
    title: "moku pona",
  },
  {
    name: "description",
    content:
      "A dinner society located in Zurich. We love sharing food and stories with our friends.",
  },
];

export default function Index() {
  return (
    <main>
      <div className="mx-auto mt-20 max-w-4xl">
        <div className="mx-2 grid grid-cols-5 gap-20">
          <div className="col-span-full max-md:overflow-hidden md:col-span-3">
            <picture>
              <img
                srcSet="/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w"
                src="/landing-page.jpg"
                className="aspect-video h-full w-full justify-end rounded-2xl object-cover"
                alt=""
              />
            </picture>
          </div>

          <div className="col-span-full flex flex-col justify-center gap-8 py-2 md:col-span-2">
            <h1 className="text-5xl lowercase text-gray-50">moku pona</h1>

            <p className="text-balance text-2xl font-thin leading-normal">
              A dinner society located in Zurich. We love sharing food and
              stories with our friends. And you?
            </p>

            <Button asChild size="lg">
              <Link to="/dinners" className="w-fit">
                join a dinner
              </Link>
            </Button>
          </div>

          <Link to="#vision" className="col-span-full mx-auto  text-accent">
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
          <p className="col-span-full flex items-center gap-10 text-xl font-light leading-relaxed">
            Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam
            nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam
            erat, sed diam voluptua. At vero eos et accusam et justo duo dolores
            et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est
            Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur
            sadipscing elitr, sed diam
            <span className="-mt-32 w-72 shrink-0">
              <FruitDrinkIllustration className="h-full w-full" />
            </span>
          </p>
        </section>
      </div>

      <picture>
        <img
          // srcSet="/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w"
          src="/accent-image.png"
          className="my-40 h-96 w-full justify-end object-cover"
          alt=""
        />
      </picture>

      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-2">
        <section className="my-5 grid max-w-4xl grid-cols-5 gap-10">
          <h2 className="col-span-full flex items-end justify-between gap-10 text-4xl">
            how&apos;s this different?
            <span className="w-80 shrink-0">
              <CoffeeIllustration className="h-full w-full" />
            </span>
          </h2>
          <p className="col-span-full text-xl font-thin leading-relaxed">
            Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam
            nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam
            erat, sed diam voluptua. At vero eos et accusam et justo duo dolores
            et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est
            Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur
            sadipscing elitr, sed diam
          </p>
        </section>
      </div>

      <div className="relative mt-32 w-full py-4 text-gray-950">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-2 after:absolute after:inset-0 after:-z-10 after:skew-y-3 after:bg-accent">
          <section className="my-5 grid max-w-4xl grid-cols-5 gap-5">
            <h2 className="col-span-full text-4xl">who we are</h2>

            <p className="col-span-2 my-auto text-xl font-thin leading-relaxed">
              Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam
              nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam
            </p>

            <div className="col-span-3 flex items-center justify-end self-center">
              {[0, 1, 2].map((_, index) => {
                const offset = -1.5 * index;

                return (
                  <picture key={`portrait-${index}`}>
                    <img
                      // srcSet="/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w"
                      src={`/portraits/portrait-${index}.jpg`}
                      className={cn(
                        "h-40 w-40 translate-x-1 rounded-full border-2 border-accent object-cover",
                      )}
                      style={{
                        transform: `translate(${offset}rem)`,
                      }}
                      alt=""
                    />
                  </picture>
                );
              })}
            </div>

            <Link to="/about" className="flex items-center gap-4">
              <span className="shrink-0">get to know us</span>
              <Arrow className="shrink-0" />
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
