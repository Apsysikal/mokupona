# accordion

## Changed

- `app/components/ui/accordion.tsx`: `AccordionPrimitive.Content` ->
  `AccordionPrimitive.Panel`; import moved to `@base-ui/react/accordion`; prop
  types moved from `React.ComponentProps<typeof …>` to the primitive's own
  `…​.Props` types.
- Chevron rotation hook: `[&[data-state=open]>svg]:rotate-180` on the trigger
  became `group-data-panel-open:rotate-180` on the icon (Base UI's accordion
  trigger exposes `data-panel-open`, not `data-open`).
- Panel animation: the keyframe pair driven by `data-[state=…]:animate-accordion-*`
  became a height transition with `data-starting-style:h-0` /
  `data-ending-style:h-0` on `h-[var(--accordion-panel-height)]`.
- `app/tailwind.css`: dropped `--animate-accordion-down` / `-up` and both
  `@keyframes` blocks, which referenced `--radix-accordion-content-height`.
- `app/features/events/components/event-view.tsx`:
  `type="single" collapsible defaultValue="menu"` -> `defaultValue={["menu"]}`.
  Base UI drops `type`/`collapsible` (single is the default and is always
  collapsible) and values are always arrays.

## Left alone

- `AccordionItem` / `AccordionTrigger` / `AccordionHeader` class strings.
- The exported wrapper names (`AccordionContent` still wraps `Panel`) so no
  consumer import changed.

## Behavior changes

- None observed. Base UI's single mode is always collapsible, which matches the
  `collapsible` prop this app passed.
- Radix's `orientation` and roving arrow-key focus are gone from Base UI; this
  app never set `orientation`.

## Verify by hand

- On a dinner page with a menu and a donation note: "menu" starts open, clicking
  it collapses, clicking "donation" opens that one and closes "menu".
- Watch the height transition -- it should ease, not jump.
