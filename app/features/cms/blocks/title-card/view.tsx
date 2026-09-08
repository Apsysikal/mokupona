import type React from "react";

import type { TitleCardBlockType } from "./model";

import { cn } from "~/lib/utils";

type TitleCardBlockViewProps = React.ComponentPropsWithoutRef<"section"> & {
  blockData: TitleCardBlockType;
};

/**
 * The title card: the club's name, a great deal of quiet, and a cue to scroll.
 * Deliberately holds nothing else — the dinners live below the fold.
 */
export function TitleCardBlockView({
  blockData,
  className,
  ...rest
}: TitleCardBlockViewProps) {
  const { title, logo, tagline, scrollTo } = blockData.data;

  return (
    <section
      className={cn(
        // Sits just under the sticky nav, so subtract its height rather than
        // using a bare 100svh, which would push the cue off-screen on mobile.
        "flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-5 py-16",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-col items-center gap-6">
        {logo ? (
          <img
            src={logo.src}
            width={logo.width}
            height={logo.height}
            alt={title}
            // Brand artwork, above the fold — never lazy-load it.
            loading="eager"
            decoding="sync"
            className="h-auto w-[min(80vw,34rem)]"
          />
        ) : (
          <h1 className="text-center text-6xl leading-none font-light tracking-tight sm:text-7xl md:text-8xl">
            {title}
          </h1>
        )}

        <HandDrawnRule className="text-teal w-[min(70vw,26rem)]" />

        {tagline ? (
          <p className="text-muted-foreground max-w-md text-center text-sm font-light tracking-wide md:text-base">
            {tagline}
          </p>
        ) : null}
      </div>

      {scrollTo ? <ScrollCue href={scrollTo} /> : null}
    </section>
  );
}

/**
 * A wobbling underline. Two offset strokes at different opacities read as
 * crayon dragged twice over the same line rather than a vector rule.
 */
function HandDrawnRule({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 14"
      fill="none"
      aria-hidden="true"
      className={cn("h-3", className)}
      preserveAspectRatio="none"
    >
      <path
        d="M4 8.5c38-3.2 77 1.4 115-1.1 41-2.7 82 2.9 123 .6 33-1.9 66 2.4 99-.4 12-1 20 .6 55 1.9"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M10 11c44 1.9 88-2.4 132-.5 47 2 94-1.7 141 .8 27 1.4 54-1.1 81 .4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

function ScrollCue({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-20 flex flex-col items-center gap-2 rounded-md px-3 py-2 text-xs tracking-[0.2em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-hidden md:mt-28"
    >
      <span>scroll</span>
      <svg
        viewBox="0 0 24 30"
        fill="none"
        aria-hidden="true"
        className="h-6 w-5 motion-safe:animate-bounce"
      >
        <path
          d="M12 3c-.6 7 .8 14-.4 22"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M5 18c3.2 3.1 5.2 6.4 7 8.7 2-2.6 3.9-5.6 7-8.4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
