# dialog

## Changed

- `app/components/ui/dialog.tsx`: import moved to `@base-ui/react/dialog`;
  `DialogPrimitive.Overlay` -> `Backdrop`, `DialogPrimitive.Content` -> `Popup`
  (centered modal, so no Positioner). Prop types moved to the primitive's own
  `…​.Props` types. The close glyph changed with the icon set (`Cross2Icon` ->
  `XIcon`).
- Enter/exit animation: `data-[state=open]:animate-in … zoom-in-95` on both the
  backdrop and the popup became opacity/scale transitions keyed on
  `data-starting-style` / `data-ending-style`.
- Call sites: `<DialogTrigger asChild><Button/></DialogTrigger>` ->
  `<DialogTrigger render={<Button/>}>…`, same for `DialogClose`
  (`app/routes/admin.users._index.tsx`,
  `app/routes/admin.dinners.$dinnerId_.gallery.tsx`).
- `app/features/gallery/components/gallery-lightbox.tsx`: Radix's
  `VisuallyHidden.Root` wrapper around the dialog title is replaced by
  `className="sr-only"` on `DialogTitle` (Base UI has no VisuallyHidden).

## Left alone

- The `overlayClassName` / `showClose` wrapper props and every class string.
- The native `<dialog>` elements the signup form builder drives itself
  (`BuilderDialog`, `LinkDialog`, `UnlinkDialog`) -- those never used Radix.

## Behavior changes

- Radix's per-interaction dismiss callbacks (`onEscapeKeyDown`,
  `onPointerDownOutside`, `onInteractOutside`, `onOpenAutoFocus`,
  `onCloseAutoFocus`) have no Base UI equivalents; they are replaced by
  `onOpenChange`'s `eventDetails.reason` plus `initialFocus` / `finalFocus`.
  **This app used none of them**, so nothing was restructured.

## Verify by hand

- Admin -> Users -> "Invite": dialog opens, Escape closes, Cancel closes.
- Admin -> a dinner -> Gallery -> trash icon: confirm dialog opens and the
  delete actually posts.
- Gallery lightbox: opens on a photo, arrows move between photos, Escape closes.
