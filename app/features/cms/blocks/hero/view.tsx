import type React from "react";
import { Link } from "react-router";

import { generateSrcSet } from "../utils";

import type { HeroBlockType } from "./model";

import { Button } from "~/components/ui/button";

type HeroBlockViewProps = React.ComponentPropsWithoutRef<"section"> & {
  blockData: HeroBlockType;
};

export function HeroBlockView({ blockData, ...rest }: HeroBlockViewProps) {
  const { data } = blockData;
  const { eyebrow, headline, description, actions = [], image } = data;
  const { src, alt, width, height } = image;
  const srcSet = generateSrcSet(src, [432, 648, 864, 1080]);

  return (
    <section className="relative isolate overflow-hidden" {...rest}>
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
          {eyebrow ? (
            <p className="text-accent font-bold lowercase">{data.eyebrow}</p>
          ) : null}

          <h1 className="text-foreground -mt-5 text-5xl">{headline}</h1>

          {description ? (
            <p className="text-foreground text-2xl font-thin text-balance">
              {description}
            </p>
          ) : null}

          {actions.length > 0 ? (
            <div className="flex gap-4">
              {actions.map((action, index) => {
                let { label, href, variant } = action;

                return (
                  <Button
                    key={index}
                    variant={variant == "primary" ? "default" : variant}
                    asChild
                  >
                    <Link to={href} className="lowercase">
                      {label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mx-auto flex not-lg:mt-10">
          <div className="max-w-3xl flex-none not-md:pl-4 md:max-w-3xl lg:max-w-4xl 2xl:max-w-none">
            <picture>
              <img
                srcSet={srcSet}
                src={src}
                className="w-304 rounded-md object-center"
                fetchPriority="high"
                width={width}
                height={height}
                alt={alt}
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
  );
}
