# Gallery prototypes

Three ways of linking images to dinners, and three ways of showing them, built
side by side so the pair can be picked from the running app rather than from a
document. **Nothing here is a decision yet** — two of the three foundations and
two of the three layouts are meant to be deleted.

## Try it

```sh
npm run setup      # migrate + seed (the seed fills all three foundations)
npm run dev
```

- `/gallery` — redirects to the default pair; the switcher at the top of the
  page swaps data model and layout independently (9 combinations).
- `/gallery/:foundation/:layout` — any pair directly, e.g. `/gallery/join/stream`.
- `/dinners/:id` for a **past** dinner — the gallery section under the story.
  `?gallery=<foundation>&layout=<layout>` swaps the pair in place.
- `/admin/dinners/:id/gallery` — one admin tab per foundation. Each tab writes
  to its own tables, so images added under one are invisible to the others.
  That is deliberate: it is what makes the three admin flows comparable.

## The seam

Everything hangs off one contract, so foundations and layouts are independently
swappable:

- `app/features/gallery/view-models.ts` — `GalleryImageModel`. A foundation may
  only ever hand out these; a layout may only ever consume them.
- `app/features/gallery/foundations/types.ts` — `GalleryFoundation`
  (`listAll` / `listForEvent`). Reads are uniform; **writes are deliberately
  not**, because the admin flow is half of what is being compared.
- `app/features/gallery/layouts/types.ts` — `GalleryLayout`, with a `page`
  variant (the standalone gallery) and a `section` variant (embedded on a past
  dinner's page).

## The three foundations

All three ship in `prisma/schema.prisma` at once (migration
`20260803140000_add_gallery_prototypes`). The migration is **additive only** —
no existing column changes meaning — so retiring the two losers is a pure
`DROP TABLE` / `DROP COLUMN` follow-up.

### A — `tagged`

`Image` gets a second, non-unique event FK (`galleryEventId`) next to the
cover's `eventId`, plus `caption` and `position` on the row.

- **Cheapest change by far** — no new tables, no new joins, reuses the image
  upload path the cover already uses.
- An image belongs to **at most one** dinner. Reusing a photo across two
  dinners means uploading it twice.
- Removing an image from a gallery means deleting the image row (and its
  stored asset). There is no "unlink".
- `Image` accumulates a third optional owner FK — the table now means "cover
  OR portrait OR gallery member", which is the smell this option trades away.

### B — `join`

`EventGalleryEntry (eventId, imageId, caption, position)`, unique on
`(eventId, imageId)`.

- Images become **reusable**: the same photo can appear under several dinners
  with different captions, and an image that belongs to no dinner is a valid
  state.
- Unlinking is not deleting — the asset survives, which is the failure mode
  `tagged` cannot avoid.
- Costs an extra table and an extra join on every read, plus real orphan
  logic: "is this image still referenced anywhere?" has to be answered before
  any asset is destroyed.

### C — `album`

`Album (title, description, eventId?)` with `eventId` nullable and `@unique`;
images point at an album.

- Galleries become **first-class**: an album carries its own title and blurb,
  and an album that belongs to no dinner ("kitchen life", "the team") costs
  nothing extra.
- The only option that supports galleries which are not about a dinner — worth
  it if the site ever wants a non-dinner gallery, dead weight if it does not.
- Heaviest schema, and one more level of indirection between a dinner and its
  photos. Every read goes event → album → images.

## The three layouts

See each module's `layout.description` for the one-line version; they are shown
under the switcher in the app.

| id | shape | bet |
| --- | --- | --- |
| `grid` | uniform square tiles + lightbox | detail lives behind a click; the page stays an even, calm field |
| `mosaic` | CSS-column masonry, intrinsic ratios | the wall itself is the experience; no crop, no modal |
| `stream` | grouped by dinner, hero + run per chapter | the gallery is an archive of evenings, not a pile of photos |

## What has to happen before any of this ships

- Pick one foundation and one layout; delete the other two of each, plus
  `app/features/gallery/components/prototype-switcher.tsx`, the
  `?gallery=`/`?layout=` overrides in `event-section.server.ts`, and the
  `/gallery/:foundation/:layout` route in favour of a plain `/gallery`.
- Follow-up migration dropping the losing tables/columns.
- Image ordering is append-only in every foundation — no drag-to-reorder admin
  UI exists yet, only the `position` column that would back one.
