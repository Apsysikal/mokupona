# button

Strategy: transformation engine on the project's own file (legacy `new-york`
style has no `base-new-york` counterpart to replay against, so the existing
classes stay exactly as they were).

## Changed

- `app/components/ui/button.tsx`: the `Slot` / `asChild` idiom is gone. A
  button that renders a real `<button>` now goes through the Base UI `Button`
  primitive (`@base-ui/react/button`). A button whose `render` produces
  something else -- every `render={<Link/>}` and `render={<a/>}` call site --
  goes through `useRender` + `mergeProps` instead. `buttonVariants` is
  untouched.
- 36 call sites across `app/` moved from
  `<Button asChild><Link to="…">text</Link></Button>` to
  `<Button render={<Link to="…" />}>text</Button>`.

## Left alone

- `buttonVariants` class strings: no Radix-specific selectors in them.
- `app/components/ui/carousel.tsx` consumes `Button` through
  `React.ComponentProps<typeof Button>` and needed no change.

## Behavior changes

- **Links deliberately bypass the Base UI Button primitive.** Base UI's docs
  are explicit: "The Button component enforces button semantics
  (`role="button"`, keyboard interaction, disabled state). It should not be
  used for links." Routing this app's 36 link-buttons through it would either
  stamp `role="button"` on navigation links (`nativeButton={false}`) or log a
  dev-mode error for every one of them (`nativeButton` left at its `true`
  default). The split keeps links announced as links. This diverges from the
  migration skill's "always use the primitive" rule for that reason.
- The Base UI Button stamps `type="button"` on a native button that receives no
  explicit `type`. Verified as a no-op here: 667 buttons and links across 19
  pages render identical `type`, `role` and `name` attributes before and after.

## Verify by hand

- Tab to "join a dinner" in the header and to an admin "Edit" button; both
  should still be announced as links and open on Enter.
- Submit one Conform-backed form (a dinner edit) and use the form builder's
  add / remove / reorder buttons -- they carry their own intent props.
