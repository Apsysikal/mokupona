# popover

## Changed

- `app/components/ui/popover.tsx`: import moved to `@base-ui/react/popover`.
  `PopoverPrimitive.Content` split into
  `Portal > Positioner > Popup`. `align`, `alignOffset`, `side` and
  `sideOffset` are declared, destructured and forwarded to the Positioner
  (leaving them in `...props` would land them on the Popup and silently break
  positioning). The Positioner carries `isolate z-50`; the Popup keeps the
  panel styling.
- `--radix-popover-content-transform-origin` -> `--transform-origin`.
- Animation: `data-[state=…]:animate-in/out` plus the four per-side
  `slide-in-from-*` classes became an opacity/scale transition on
  `data-starting-style` / `data-ending-style`.

## Left alone

- `PopoverTrigger` at `app/features/events/components/event-view.tsx` -- it
  wraps a `<span>` inside the trigger button, which is valid in both libraries.

## Behavior changes

- **Collision defaults differ and were not patched.** Base UI's Positioner
  defaults are `collisionPadding: 5` (Radix: 0), `arrowPadding: 5` (Radix: 0)
  and `collisionBoundary: 'clipping-ancestors'` (Radix: the viewport). The
  "discounts" popover is the only one in the app and it renders identically in
  the captured screenshots, but placement near a viewport or overflow edge can
  differ by a few pixels.
- Radix's `Popover.Anchor` has no Base UI counterpart (the Positioner takes an
  `anchor` prop instead). Not used here.

## Verify by hand

- Dinner page -> "discounts": opens on click, closes on Escape and on outside
  click, and stays inside the viewport when the card sits near the bottom edge.
