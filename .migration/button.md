# button

Strategy: transformation engine on the project's own file (legacy `new-york`
style has no `base-new-york` counterpart to replay against, so the existing
classes stay exactly as they were).

## Changed

- `app/components/ui/button.tsx`: the `Slot` / `asChild` idiom is replaced by
  Base UI's `Button` primitive (`@base-ui/react/button`). `buttonVariants` is
  untouched and is now also the public way to style a link.
- 34 call sites that used `<Button asChild>` around a `Link`, `NavLink` or `a`
  now render the link directly with the button classes:
  `<Link to="…" className={buttonVariants({ variant: "outline" })}>`, using
  `cn()` where the call site added classes of its own. This is what the shadcn
  Button docs prescribe under "As Link".
- The remaining `render` usages are Base UI parts rendering our Button
  (`<DialogTrigger render={<Button/>}>`, `<DialogClose render={<Button/>}>`),
  which is the right direction: the rendered element really is a button.

## Left alone

- `buttonVariants` class strings: no Radix-specific selectors in them, and the
  link call sites now produce the exact same class list they did before.
- `app/components/ui/carousel.tsx` consumes `Button` through
  `React.ComponentProps<typeof Button>` and needed no change.

## Behavior changes

- **Links never pass through the Button component.** Base UI's Button always
  applies `role="button"`, which overrides the semantic link role on an `<a>`,
  and its docs say so explicitly. Styling the anchor with `buttonVariants`
  keeps links announced as links — the same DOM the Radix `Slot` produced.
- **Base UI stamps `type="button"` on a button that receives no explicit type,
  and the wrapper undoes that.** It is the opposite of the HTML default, and
  Conform's intent buttons rely on the default: "Add field", "Remove",
  "Unlink", "Link to friends" and "Reset to default" carry their intent in
  `name="__intent__"` + `value` and need the submit. Leaving the stamped `type`
  in place turned all of them into no-ops; Cypress caught it
  (`admin-form-builder.cy.ts`). The wrapper now threads `type` through last,
  `undefined` included, which suppresses the injected default.
  `app/components/ui/button.test.tsx` pins both the attribute and the submit.

## Verify by hand

- Tab to "join a dinner" in the header and to an admin "Edit" button; both
  should still be announced as links and open on Enter.
- Submit one Conform-backed form (a dinner edit) and use the form builder's
  add / remove / reorder buttons -- they carry their own intent props.

## Baseline note

An early version of this report claimed the Button change was DOM-neutral on
the strength of a 667-element comparison. That comparison was between two
post-migration builds, so it could not have caught the `type` regression above.
The check was redone against `origin/dev`: 906 buttons, inputs, selects,
textareas and links across 20 pages, comparing `type`, `name`, `value`, `form`,
`formnovalidate`, `disabled` and `role` -- zero differences, and still zero
after moving the links onto `buttonVariants`.
