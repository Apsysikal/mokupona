import { Link } from "react-router";

import type { GalleryFoundationOption } from "../foundations/types";
import type { GalleryLayoutOption } from "../layouts";

import { chipVariants, Eyebrow } from "~/components/section";

/**
 * Prototype scaffolding, not product chrome: the gallery ships as three
 * foundations × three layouts so the combinations can be compared in the
 * running app. Whichever pair wins, this switcher goes out with the losers.
 */
export function GalleryPrototypeSwitcher({
  foundations,
  layouts,
  currentFoundationId,
  currentLayoutId,
}: {
  foundations: GalleryFoundationOption[];
  layouts: GalleryLayoutOption[];
  currentFoundationId: string;
  currentLayoutId: string;
}) {
  const current =
    foundations.find(({ id }) => id === currentFoundationId) ?? null;
  const currentLayout =
    layouts.find(({ id }) => id === currentLayoutId) ?? null;

  return (
    <div className="border-primary/20 bg-primary/5 mb-9 flex flex-col gap-4 rounded-2xl border border-dashed p-5">
      <Eyebrow variant="tracked" tone="label">
        prototype — pick a data model and a layout
      </Eyebrow>

      <SwitcherRow
        label="data model"
        options={foundations}
        currentId={currentFoundationId}
        hrefFor={(id) => `/gallery/${id}/${currentLayoutId}`}
      />
      <SwitcherRow
        label="layout"
        options={layouts}
        currentId={currentLayoutId}
        hrefFor={(id) => `/gallery/${currentFoundationId}/${id}`}
      />

      <p className="text-foreground/65 max-w-2xl text-sm leading-relaxed">
        {current ? <span className="block">{current.description}</span> : null}
        {currentLayout ? (
          <span className="block">{currentLayout.description}</span>
        ) : null}
      </p>
    </div>
  );
}

function SwitcherRow({
  label,
  options,
  currentId,
  hrefFor,
}: {
  label: string;
  options: { id: string; label: string }[];
  currentId: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-foreground/50 w-20 shrink-0 text-xs">{label}</span>
      {options.map((option) => (
        <Link
          key={option.id}
          to={hrefFor(option.id)}
          prefetch="intent"
          aria-current={option.id === currentId ? "page" : undefined}
          className={chipVariants({ active: option.id === currentId })}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
