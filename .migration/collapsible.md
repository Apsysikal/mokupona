# collapsible

## Changed

- `app/components/ui/collapsible.tsx`: import moved to
  `@base-ui/react/collapsible`; `CollapsibleContent` now re-exports
  `CollapsiblePrimitive.Panel`.
- `app/components/signup-form-builder.tsx`:
  - `<CollapsibleContent forceMount data-row-body className="data-[state=closed]:hidden">`
    -> `<CollapsibleContent keepMounted data-row-body>`. Base UI sets the
    `hidden` attribute on a closed, kept-mounted panel, so the class that did
    that job by hand is gone.
  - Trigger chevron: `[&[data-state=open]>svg]:rotate-180` ->
    `[&[data-panel-open]>svg]:rotate-180`.
- `cypress/e2e/admin-form-builder.cy.ts`: the one assertion that read Radix's
  `data-state` attribute (`$button.attr("data-state") === "closed"`) now checks
  for the absence of `data-panel-open`.

## Left alone

- The `Set<string>`-based open-state control in the form builder: `open` /
  `onOpenChange` keep the same shape (Base UI adds a second `eventDetails`
  argument, which the existing handler ignores).
- `cypress/e2e/admin-form-builder.cy.ts` line 233's `.filter(":visible")` --
  still correct, because the `hidden` attribute computes to `display: none`
  exactly as the old `hidden` utility class did (verified in the browser).

## Behavior changes

- **Closed rows are hidden by attribute now, not by class.** Fields inside them
  stay mounted and submittable either way: verified 12 closed rows holding 110
  inputs, all present in the DOM with `display: none`.

## Verify by hand

- Open a dinner's edit page, collapse a signup-form row that has values, save,
  and confirm the collapsed row's values still round-trip.
- Run the Cypress suite in CI -- it could not run in the migration environment.
