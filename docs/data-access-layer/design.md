# Design — Data-Access Layer in `app/models/`

Goal: routes, features, and utils never touch Prisma. The existing model files
**are** the data-access layer; their public interfaces take scalars and declared
domain types — never Prisma `select` / `where` / `include` / `data` shapes — so
the ORM could be swapped by rewriting model bodies while every consumer stays
untouched.

## Boundary rule

**Only `app/models/**` may import `~/db.server` and `#prisma/generated/client`.**

- Enforce with an ESLint `no-restricted-imports` override once migration lands.
- _Within_ the models layer, Prisma types stay legal: the cross-model
  transaction seams (`deleteEventsInTx`, `saveFormSchemaInTx`, both taking
  `Prisma.TransactionClient`) are internal plumbing. Swapping the ORM rewrites
  model bodies wholesale anyway; the rule guarantees the blast radius ends at
  the models' public interfaces.
- Entity types consumers need (`User`, `EventResponse`, `FormVersion`, …) are
  re-exported from the model file (as `user.server.ts` already does for `User`),
  never imported from the generated client elsewhere.
- Functions returning projections declare **explicit return types** rather than
  letting Prisma infer them — the declared type is the actual contract a
  replacement implementation must satisfy.

## Leak inventory (current state)

### Routes/utils calling `prisma` directly — need new models

| Call site                                                     | Direct call                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `admin.board-members.tsx:12`                                   | `boardMember.findMany` (+ image id include)                     |
| `admin.board-members.new.tsx:81`                               | `boardMember.create` (nested image create)                      |
| `admin.board-members.$userId.edit.tsx:94`                      | `$transaction`: `image.deleteMany` + `boardMember.update`       |
| `routes/file.$fileId.tsx:119`                                  | `image.findUnique`                                              |
| `utils/image-upload.server.ts:79`                              | `image.create`                                                  |
| `admin.users.$userId.delete.tsx:18`                            | `role.findFirst` (role of a user)                               |
| `admin.users.$userId_.edit.tsx:56`                             | `role.findUnique` (role by name)                                |
| `routes/healthcheck.tsx:16`                                    | `user.count()` as a DB ping                                     |

### Prisma calling formats exposed by existing models

- `user.server.ts` exports `UserSelect` / `UserWhereUnique` / `UserUpdateData`
  and generic `getUsers<T extends UserSelect>(select)`,
  `getUserById(id, select)`, `updateUser(where, data)`. Routes build raw
  Prisma objects: `admin.users._index.tsx:13`, `admin.users.$userId_.edit.tsx:24`
  (select) and `:83` (a `where` carrying the **"not admin" business rule**),
  `me.tsx:16`.
- `getEvents(filter?: Prisma.EventWhereInput)` and
  `getAddresses(filter?: Prisma.AddressWhereInput)` — **no caller passes a
  filter**; the params are speculative surface. Drop them.
- `createEvent` / `updateEvent` take `Prisma.EventUncheckedCreateInput` /
  `...UpdateInput`; callers already pass plain scalar objects.
- `createFormSubmission({ answers: Prisma.InputJsonValue })` forces
  `dinners_.$dinnerId.tsx:124` to import `Prisma` and cast.
- `features/signup-form/read.server.ts:1` imports the `EventResponse` type from
  the generated client (type-only).

### Latent bug removed by the redesign

`getUserById(id, select = {} as T)`: calling it without a select — as
`session.server.ts:39,70` (`getUser` / `requireUser`) does — sends `select: {}`
to Prisma, which throws "needs at least one truthy value" at runtime. Currently
unexercised (`root.tsx` only uses `getUserWithRole`), but it's a landmine.

## Target public interfaces

### `user.server.ts` (rework — the only substantial one)

```ts
export type { User };
getUserById(id: string): Promise<User | null>;
getUserByIdWithRole(id: string): Promise<(User & { role: Role }) | null>;
getUserByEmail(email: string): Promise<User | null>;

// replaces getUsers(select) — the one projection admin.users._index needs
listUsersWithRoleName(): Promise<{ id: string; email: string; role: { name: string } }[]>;

// replaces the ad-hoc selects in me.tsx and admin.users.$userId_.edit (shared)
getUserAccountSummary(id: string):
  Promise<{ email: string; role: { name: string; description: string } } | null>;

createUser(email: string, password: string, roleName?: string): Promise<User>;
verifyLogin(email: string, password: string): Promise<Omit<User, "password"> | null>;

// absorbs the { role: { NOT: { name: "admin" } } } guard from the route
updateNonAdminUserRole(userId: string, roleId: string): Promise<void>;

deleteUserById(id: string): Promise<User>;
deleteUserByEmail(email: string): Promise<User>;
```

### `role.server.ts` (new)

```ts
getRoleByName(name: string): Promise<Role | null>;        // user edit action; createUser internally
getRoleNameForUser(userId: string): Promise<string | null>; // user delete action
```

### `event.server.ts` (signature trim; bodies stay)

```ts
interface EventCreateData {
  title: string; description: string;
  menuDescription?: string | null; donationDescription?: string | null;
  date: Date; slots: number; price: number; discounts?: string | null;
  addressId: string; imageId: string; createdById: string;
}
type EventUpdateData = Partial<EventCreateData>;

getEvents(): Promise<Event[]>;                       // filter param dropped
getEventById(id: string): Promise<(Event & { address: Address }) | null>;
createEvent(data: EventCreateData, formFields?: FieldDescriptor[]): Promise<Event>;
updateEvent(id: string, data: EventUpdateData, formFields?: FieldDescriptor[]): Promise<Event>;
deleteEvent(id: string): Promise<Event>;
// deleteEventsInTx: stays, models-internal
```

### `address.server.ts`

Drop the unused filter param on `getAddresses()`. Otherwise already clean.

### `form.server.ts`

Public surface already Prisma-free. Re-export a `FormVersion` type.
`saveFormSchemaInTx` stays models-internal.

### `form-submission.server.ts`

```ts
createFormSubmission({ formVersionId, answers, expectedVersionUpdatedAt }: {
  formVersionId: string;
  answers: Record<string, unknown>;   // cast to InputJsonValue inside the model
  expectedVersionUpdatedAt?: Date;
}): Promise<FormSubmission>;
```

`eventHasSignups`, `getFormSubmissionsForEvent`, `FormVersionChangedError`
unchanged. The route-side `as Prisma.InputJsonValue` cast disappears.

### `event-response.server.ts`

Already clean. Add `export type { EventResponse }` so
`features/signup-form/read.server.ts` imports the type from here.

### `board-member.server.ts` (new)

```ts
interface ImageData { contentType: string; blob: Buffer }

listBoardMembers():
  Promise<{ id: string; name: string; position: string; imageId: string | null }[]>;
getBoardMemberById(id: string): Promise<BoardMember | null>;
createBoardMember(data: { name: string; position: string; image?: ImageData }): Promise<BoardMember>;
// internally a transaction: deletes the old image iff a new one is provided
updateBoardMember(id: string, data: { name: string; position: string; image?: ImageData }): Promise<BoardMember>;
```

### `image.server.ts` (new)

```ts
createImage(data: ImageData): Promise<{ id: string }>;  // image-upload.server.ts persistImage
getImageById(id: string): Promise<Image | null>;        // file.$fileId loader
```

### Healthcheck

`pingDatabase(): Promise<void>` on `db.server.ts` (or a tiny `health.server.ts`)
so the route stops importing `prisma`.

## DRY findings and decisions

1. **Board-member new/edit routes duplicate ~80 lines each** (`MemberSchema`,
   `validImageTypes`, image-bytes conversion, persistence shape).
   → **Fix**: shared schema/constants module + the new model functions.
2. **`Buffer.from(await image.arrayBuffer())` image-bytes conversion exists in
   three places** (both board-member routes, `image-upload.server.ts`).
   → **Fix**: one `fileToImageData(file: File): Promise<ImageData>` helper.
3. **Three ad-hoc user role-name projections** across `admin.users._index`,
   `admin.users.$userId_.edit`, `me.tsx`.
   → **Fix**: `listUsersWithRoleName` + `getUserAccountSummary` (the direct
   payoff of dropping the generic `select` parameter).
4. **Role-by-name lookup in two places** (user-edit action inline, inside
   `createUser`). → **Fix**: both route through `role.server.ts#getRoleByName`.
5. ~~Composite `getEventWithCurrentFormVersion` accessor~~ — **dropped**: the
   `getEventById` + `getCurrentFormVersionForEvent` pair at each site is
   explicit and readable; a composite mostly saves an import.
6. ~~Wrapper for the delete-with-form-cascade shape~~ — **dropped**: already
   factored around `deleteEventsInTx`; a wrapper saves ~3 lines per site at the
   cost of indirection.

## Migration order

1. **New models** (`board-member`, `image`, `role`, DB ping) — purely additive;
   move the direct-`prisma` routes/utils onto them.
2. **`user.server.ts` rework** — new named finders, migrate the three routes +
   `session.server.ts`, delete the generic `select`/`where` surface.
3. **Signature trims** — `getEvents` / `getAddresses` filter params,
   `EventCreateData`/`EventUpdateData`, `createFormSubmission` answers type,
   `EventResponse` re-export.
4. **Lock the boundary** — ESLint `no-restricted-imports` for `~/db.server` and
   `#prisma/generated/*` outside `app/models/**`.
