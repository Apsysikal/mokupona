import type React from "react";

import type { TextSectionBlockType } from "./model";

import { Eyebrow, PageContainer } from "~/components/section";

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
      <div className="relative mx-auto w-full max-w-5xl px-5" {...rest}>
        <div
          aria-hidden
          className="bg-primary absolute inset-x-0 -inset-y-1.5 -skew-y-3 rounded-xs"
        />
        <section className="relative my-9 md:mt-18 md:mb-24 md:px-5">
          <div className="text-primary-foreground relative flex flex-col gap-3 py-8 md:gap-4 md:py-16">
            {eyebrow ? (
              <span className="text-xs font-semibold tracking-widest uppercase opacity-70">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="text-2xl leading-tight font-light tracking-tight md:text-3xl">
              {headline}
            </h2>
            <p className="text-base leading-relaxed font-light md:text-lg">
              {body}
            </p>
          </div>
        </section>
      </div>
    );
  }

  // editorial two-column grid: eyebrow + headline left, body right
  return (
    <PageContainer as="div" {...rest}>
      <section className="grid items-start gap-3 py-9 md:grid-cols-[1fr_1.2fr] md:gap-12 md:py-14">
        <div className="flex flex-col gap-3 md:gap-4">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h2 className="text-2xl font-light tracking-tight md:text-3xl">
            {headline}
          </h2>
        </div>
        <p className="text-foreground/80 text-base leading-relaxed font-light md:text-lg">
          {body}
        </p>
      </section>
    </PageContainer>
  );
}
