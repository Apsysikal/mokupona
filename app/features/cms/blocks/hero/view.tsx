import type React from "react";
import { Link } from "react-router";

import { generateSrcSet } from "../utils";

import type { HeroBlockType } from "./model";

import { Eyebrow, SecondaryCTA } from "~/components/section";
import { Button } from "~/components/ui/button";

type HeroBlockViewProps = React.ComponentPropsWithoutRef<"section"> & {
  blockData: HeroBlockType;
};

// editorial split hero: copy on the left, a full-height photo on the right;
// on mobile the photo moves above the copy (design handoff §1)
export function HeroBlockView({ blockData, ...rest }: HeroBlockViewProps) {
  const { data } = blockData;
  const {
    eyebrow,
    headline,
    headlineAccent,
    description,
    actions = [],
    meta,
    image,
  } = data;
  const { src, alt, width, height } = image;
  const srcSet = generateSrcSet(src, [432, 648, 864, 1080]);

  return (
    <section
      className="mx-auto flex max-w-7xl flex-col md:min-h-130 md:flex-row"
      {...rest}
    >
      <div className="flex flex-col justify-center gap-5 px-6 py-8 md:w-[46%] md:gap-6 md:px-14 md:py-16">
        {eyebrow ? (
          <Eyebrow variant="kicker" tone="primary">
            {eyebrow}
          </Eyebrow>
        ) : null}

        <h1 className="text-4xl font-light tracking-tight text-balance md:text-5xl">
          {headline}
          {headlineAccent ? (
            <>
              {" "}
              <span className="text-primary italic">{headlineAccent}</span>
            </>
          ) : null}
        </h1>

        {description ? (
          <p className="text-foreground/80 max-w-md text-base leading-relaxed font-light md:text-lg">
            {description}
          </p>
        ) : null}

        {actions.length > 0 ? (
          <div className="mt-1 flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
            {actions.map((action, index) =>
              action.variant === "secondary" ? (
                <SecondaryCTA
                  key={index}
                  to={action.href}
                  className="max-md:self-center"
                >
                  {action.label}
                </SecondaryCTA>
              ) : (
                <Button key={index} asChild>
                  <Link to={action.href}>{action.label}</Link>
                </Button>
              ),
            )}
          </div>
        ) : null}

        {meta ? (
          <div className="text-foreground/40 mt-2 text-xs tracking-widest uppercase">
            {meta}
          </div>
        ) : null}
      </div>

      <div className="relative h-72 max-md:order-first md:h-auto md:w-[54%]">
        <picture>
          <img
            srcSet={srcSet}
            src={src}
            className="absolute inset-0 size-full object-cover"
            fetchPriority="high"
            width={width}
            height={height}
            alt={alt ?? ""}
          />
        </picture>
      </div>
    </section>
  );
}
