import type React from "react";
import { useEffect, useRef, useState } from "react";

import rowsData from "./rows.json";
import { rowOffset } from "./scroll-offset";

import { cn } from "~/lib/utils";

const SPRITE_URL = "/sitelen/sprite.svg";
/** px of row travel per px of page scroll */
const SPEED = 0.55;
/** copies of each row laid end to end, so a wide screen never sees the end */
const COPIES = 3;
const DIRECTIONS = [-1, 1, -1] as const;
/** the light paper patterns the sprite's symbols cycle through */
const LIGHT_PATTERNS = 4;
const TEXTURE_UNITS = 64;

/**
 * Three rows of torn-paper toki pona glyphs (sitelen moku pona) that slide
 * left, right, left as the page scrolls, and back again on the way up.
 * A glyph grows while the pointer is on it; on touch screens a tap pops it.
 *
 * The glyph shapes arrive as one sprite after hydration — they are
 * decoration, so the band reserves its height and the glyphs fade in.
 */
export function SitelenRows({ className }: { className?: string }) {
  const sprite = useSprite();
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  useScrollLinkedRows(rowRefs, sprite !== null);

  return (
    <section
      aria-hidden="true"
      className={cn(
        "art-warm relative overflow-hidden py-8 select-none md:py-12",
        className,
      )}
      style={
        {
          "--smp-rim": "rgb(246 240 252)",
          "--smp-shadow": "rgb(43 18 56 / 0.2)",
        } as React.CSSProperties
      }
    >
      <PaperPatterns />
      {sprite ? (
        // Kept in the DOM but out of sight: patterns and symbols inside a
        // display:none subtree don't render in every browser.
        <div
          className="absolute size-0 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: sprite }}
        />
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-2 transition-opacity duration-700 md:gap-4",
          sprite ? "opacity-100" : "opacity-0",
        )}
      >
        {rowsData.rows.map((words, row) => (
          <div
            key={row}
            ref={(el) => {
              rowRefs.current[row] = el;
            }}
            className="flex w-max will-change-transform"
          >
            {Array.from({ length: COPIES }, (_, copy) =>
              words.map((word, i) => (
                <Glyph
                  key={`${copy}-${word}`}
                  word={word}
                  index={i + row * 7}
                />
              )),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Glyph({ word, index }: { word: string; index: number }) {
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    if (!popped) return;
    const t = window.setTimeout(() => setPopped(false), 650);
    return () => window.clearTimeout(t);
  }, [popped]);

  // a little scrapbook unevenness: each glyph sits slightly off the line
  const nudge = ((index * 37) % 17) - 8;

  return (
    <span
      className={cn(
        "group relative -mx-1 block shrink-0 hover:z-10 md:mx-0",
        popped && "z-10",
      )}
      style={{ transform: `translateY(${nudge}px)` }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") setPopped(true);
      }}
    >
      <svg
        viewBox="-8 -8 116 116"
        className={cn(
          "size-18 transition-transform duration-500 ease-[cubic-bezier(.3,1.6,.5,1)] group-hover:scale-[1.6] motion-reduce:transition-none md:size-24",
          popped && "scale-[1.6]",
        )}
      >
        <use href={`#smp-${word}`} />
      </svg>
    </span>
  );
}

/**
 * The paper textures, defined once for the whole page. The sprite's symbols
 * fill with url(#smp-paper-l0..3) and url(#smp-paper-d); the light pattern
 * comes in a few offsets so neighbouring glyphs don't show the same patch.
 */
function PaperPatterns() {
  const t = TEXTURE_UNITS;
  return (
    <svg className="absolute size-0" aria-hidden="true">
      <defs>
        {Array.from({ length: LIGHT_PATTERNS }, (_, i) => (
          <pattern
            key={i}
            id={`smp-paper-l${i}`}
            patternUnits="userSpaceOnUse"
            width={t}
            height={t}
            patternTransform={`translate(${(i * 23) % t} ${(i * 41) % t}) rotate(${i * 90})`}
          >
            <image href="/sitelen/paper-light.jpg" width={t} height={t} />
          </pattern>
        ))}
        <pattern
          id="smp-paper-d"
          patternUnits="userSpaceOnUse"
          width={t}
          height={t}
        >
          <image href="/sitelen/paper-dark.jpg" width={t} height={t} />
        </pattern>
      </defs>
    </svg>
  );
}

function useSprite() {
  const [sprite, setSprite] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(SPRITE_URL)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (live && text) setSprite(text);
      })
      // decoration only: without the sprite the band just stays empty
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return sprite;
}

function useScrollLinkedRows(
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>,
  ready: boolean,
) {
  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const place = () => {
      frame = 0;
      const y = reduced.matches ? 0 : window.scrollY;
      rowRefs.current.forEach((row, i) => {
        if (!row) return;
        const copyWidth = row.scrollWidth / COPIES;
        // stagger the rows so the same words don't line up vertically
        const x = rowOffset(y, DIRECTIONS[i] ?? -1, copyWidth, SPEED, i * 173);
        row.style.transform = `translate3d(${x}px, 0, 0)`;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready, rowRefs]);
}
