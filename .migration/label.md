# label

## Changed

- `app/components/ui/label.tsx`: `Label.Root` from `radix-ui` is replaced by a
  native `<label>` rendered through `useRender`, which keeps the `render` prop
  the one polymorphic call site needs.
- `app/routes/admin.users._index.tsx`: `<Label asChild><span id={labelId}>Role
</span></Label>` became `<Label render={<span id={labelId} />}>Role</Label>`
  (the radiogroup's label is a `<span>`, not a `<label>`).
- Added `select-none` to `labelVariants`.

## Left alone

- `app/components/forms.tsx` and the field wrappers: they pass `htmlFor` and
  children, both unchanged.

## Behavior changes

- **Text selection on labels is now fully disabled.** Radix's Label had one
  behavioral extra over a native `<label>`: it suppressed text selection when
  you double-click. Base UI has no Label primitive, and the documented parity
  for that behavior is `select-none` -- which is broader, since it also stops
  click-and-drag selection of label text. Remove the class if that matters.

## Verify by hand

- Open the invite dialog under Admin -> Users and check the "Role" group is
  still announced with its label.
- Click a field label in any form; focus should still move into its input.
