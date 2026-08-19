# icons

Not part of the Base UI switch itself -- Base UI ships no icon set. Removing
every Radix package meant replacing `@radix-ui/react-icons`, and this was an
explicit choice, so it is recorded here as its own step.

## Changed

- 27 icons across 25 files moved to `lucide-react`:

| Radix                       | lucide              | Radix                 | lucide         |
| --------------------------- | ------------------- | --------------------- | -------------- |
| `ArrowDownIcon`             | `ArrowDownIcon`     | `InfoCircledIcon`     | `InfoIcon`     |
| `ArrowRightIcon`            | `ArrowRightIcon`    | `Link2Icon`           | `LinkIcon`     |
| `ArrowUpIcon`               | `ArrowUpIcon`       | `LinkBreak2Icon`      | `Link2OffIcon` |
| `CalendarIcon`              | `CalendarIcon`      | `LockClosedIcon`      | `LockIcon`     |
| `CheckCircledIcon`          | `CircleCheckIcon`   | `MagnifyingGlassIcon` | `SearchIcon`   |
| `CheckIcon`                 | `CheckIcon`         | `PersonIcon`          | `UserIcon`     |
| `ChevronDownIcon`           | `ChevronDownIcon`   | `PlusIcon`            | `PlusIcon`     |
| `ChevronLeftIcon`           | `ChevronLeftIcon`   | `SewingPinIcon`       | `MapPinIcon`   |
| `ChevronRightIcon`          | `ChevronRightIcon`  | `TrashIcon`           | `Trash2Icon`   |
| `Cross1Icon` / `Cross2Icon` | `XIcon`             | `DownloadIcon`        | `DownloadIcon` |
| `EnvelopeClosedIcon`        | `MailIcon`          | `ImageIcon`           | `ImageIcon`    |
| `ExclamationTriangleIcon`   | `TriangleAlertIcon` |                       |                |

- `InstagramLogoIcon` has no lucide equivalent (lucide dropped brand marks). It
  is now a local SVG, `InstagramIcon` in `app/components/icons.tsx`, next to the
  hand-drawn `UtensilsIcon` and `CreditCardIcon` that were already there.
- Eight icons that rendered at the Radix 15px default with no size class were
  given `size-4` so lucide's 24px default does not blow up the layout
  (`app/components/signup-form-builder.tsx`).

## Left alone

- `app/components/icons.tsx`'s existing local SVGs.
- Every explicit `size-*` class on an icon call site.

## Behavior changes

- Purely visual. Most glyphs are near-identical; `SewingPinIcon -> MapPinIcon`,
  `TrashIcon -> Trash2Icon` and the calendar are visibly redrawn (lucide is a
  24px stroke set, radix-icons a 15px mixed fill/stroke set).

## Verify by hand

- Scan the dinner fact list (calendar, pin, price, seats), the admin list
  headers, and the site header's Instagram mark.
