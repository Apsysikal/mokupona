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
- **Base UI stamps `type="button"` on a native button that receives no explicit
  type, and the wrapper undoes that.** Both the Button primitive and `useRender`
  do it, and it is the opposite of the HTML default: a bare `<button>` inside a
  form submits. Conform's intent buttons rely on exactly that — "Add field",
  "Remove", "Unlink", "Link to friends" and "Reset to default" carry their
  intent in `name="__intent__"` + `value` and need the submit. Leaving the
  stamped `type` in place turned all of them into no-ops; Cypress caught it
  (`admin-form-builder.cy.ts`). The wrapper now threads `type` through last,
  `undefined` included, which suppresses the injected default.
  `app/components/ui/button.test.tsx` pins both the attribute and the submit.

## Verify by hand

- Tab to "join a dinner" in the header and to an admin "Edit" button; both
  should still be announced as links and open on Enter.
- Submit one Conform-backed form (a dinner edit) and use the form builder's
  add / remove / reorder buttons -- they carry their own intent props.

## Baseline note

The first version of this report claimed the Button change was DOM-neutral on
the strength of a 667-element comparison. That comparison was between two
post-migration builds, so it could not have caught the `type` regression above.
The check was redone against `origin/dev`: 906 buttons, inputs, selects,
textareas and links across 20 pages, comparing `type`, `name`, `value`, `form`,
`formnovalidate`, `disabled` and `role` -- zero differences.
