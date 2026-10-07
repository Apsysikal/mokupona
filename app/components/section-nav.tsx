import { useEffect, useState } from "react";

import { chipVariants } from "./section";

export interface SectionNavSection {
  id: string;
  label: string;
}

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
      className="bg-background/85 sticky top-0 z-10 -mx-2 px-2 py-2 backdrop-blur md:top-8 md:z-auto md:mx-0 md:w-48 md:shrink-0 md:self-start md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
    >
      <ul className="scrollbar-hidden flex gap-2 overflow-x-auto whitespace-nowrap md:flex-col md:gap-1 md:overflow-visible md:whitespace-normal">
        {sections.map((section) => {
          const active = section.id === activeId;

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(event) => {
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
