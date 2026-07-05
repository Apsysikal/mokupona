import type React from "react";
import { Link } from "react-router";

import { generateSrcSet } from "../utils";

import type { HeroBlockType } from "./model";

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
      <div className="flex flex-col justify-center gap-5 px-6 py-8 md:w-[47%] md:gap-6.5 md:px-14 md:py-17.5">
        {eyebrow ? (
          <span className="text-primary text-[13px] font-semibold">
            {eyebrow}
          </span>
        ) : null}

        <h1 className="text-[34px] leading-[1.06] font-light tracking-[-.02em] text-balance md:text-[52px]">
          {headline}
          {headlineAccent ? (
            <>
              {" "}
              <span className="text-primary italic">{headlineAccent}</span>
            </>
          ) : null}
        </h1>

        {description ? (
          <p className="text-fg-secondary max-w-100 text-base leading-relaxed font-light md:text-[19px]">
            {description}
          </p>
        ) : null}

        {actions.length > 0 ? (
          <div className="mt-1 flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
            {actions.map((action, index) =>
              action.variant === "secondary" ? (
                <Link
                  key={index}
                  to={action.href}
                  className="border-foreground/35 hover:border-foreground w-fit border-b pb-0.5 text-[15px] max-md:self-center"
                >
                  {action.label}
                </Link>
              ) : (
                <Button key={index} className="h-11.5" asChild>
                  <Link to={action.href}>{action.label}</Link>
                </Button>
              ),
            )}
          </div>
        ) : null}

        {meta ? (
          <div className="text-fg-faint mt-2.5 text-xs tracking-[.18em] uppercase">
            {meta}
          </div>
        ) : null}
      </div>

      <div className="relative h-72.5 max-md:order-first md:h-auto md:w-[53%]">
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
