import type React from "react";

import type { TextSectionBlockType } from "./model";

import { Eyebrow } from "~/components/section";

type TextSectionBlockViewProps = React.ComponentPropsWithoutRef<"div"> & {
  blockData: TextSectionBlockType;
};

export function TextSectionBlockView({
  blockData,
  ...rest
}: TextSectionBlockViewProps) {
  const { data } = blockData;
  const { eyebrow, headline, body, variant } = data;

  if (variant === "slanted") {
    // full accent band, skewed, dark copy (the "who we are" panel)
    return (
      <div className="mx-auto w-full max-w-260 px-4 md:px-14" {...rest}>
        <section className="relative my-9 md:mt-18 md:mb-24">
          <div
            aria-hidden
            className="bg-primary absolute inset-x-0 -inset-y-1.5 -skew-y-3 rounded-[3px]"
          />
          <div className="text-primary-foreground relative flex flex-col gap-3 px-6.5 py-8.5 md:gap-4.5 md:px-14 md:py-16">
            {eyebrow ? (
              <span className="text-xs font-bold tracking-[.24em] uppercase opacity-70">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="text-2xl leading-tight font-normal md:text-[32px]">
              {headline}
            </h2>
            <p className="max-w-[760px] text-[15px] leading-relaxed md:text-lg">
              {body}
            </p>
          </div>
        </section>
      </div>
    );
  }

  // editorial two-column grid: eyebrow + headline left, body right
  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 md:px-14" {...rest}>
      <section className="grid items-start gap-3.5 py-9 md:grid-cols-[1fr_1.6fr] md:gap-12 md:py-14">
        <div className="flex flex-col gap-3.5 md:gap-4">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h2 className="text-[26px] leading-[1.15] font-light md:text-[32px]">
            {headline}
          </h2>
        </div>
        <p className="text-fg-secondary text-[15px] leading-[1.75] font-light md:text-lg">
          {body}
        </p>
      </section>
    </div>
  );
}
