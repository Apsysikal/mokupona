import { useEffect, useState } from "react";

import { chipVariants } from "./section";

export interface SectionNavSection {
  id: string;
  label: string;
}

// Sticky jump-nav for long forms: a 220px rail on desktop, a horizontally
// scrollable chip bar pinned to the top on mobile. Anchors target element
// ids, the active section is tracked with an IntersectionObserver band near
// the top of the viewport.
export function SectionNav({ sections }: { sections: SectionNavSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      // a section becomes "active" while it crosses the 15%–25% band from
      // the viewport top
      { rootMargin: "-15% 0px -75% 0px" },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Form sections"
      // the strip matches the page body so it reads as transparent while
      // still masking content scrolling underneath
      className="bg-background/85 sticky top-0 z-10 -mx-2 px-2 py-2 backdrop-blur md:top-8 md:z-auto md:mx-0 md:w-48 md:shrink-0 md:self-start md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
    >
      <ul className="flex scrollbar-none gap-2 overflow-x-auto whitespace-nowrap md:flex-col md:gap-1 md:overflow-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const active = section.id === activeId;

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(event) => {
                  // native anchors ignore a click when the hash already
                  // matches — scroll explicitly so re-taps always jump
                  event.preventDefault();
                  document
                    .getElementById(section.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.history.replaceState(null, "", `#${section.id}`);
                }}
                aria-current={active ? "true" : undefined}
                className={chipVariants({ active, size: "nav" })}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
