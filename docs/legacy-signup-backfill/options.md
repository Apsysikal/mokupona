# Backfilling legacy `EventResponse` rows into `FormSubmission`

Exploration, not a decision. The goal is to retire the legacy read path that
[`docs/customizable-signup-form/design.md` §3.3](../customizable-signup-form/design.md)
deliberately deferred ("whether to eventually migrate or remove this data is
deliberately deferred"), by turning every `EventResponse` row into a
`FormSubmission` so the merge in the read layer can be deleted.

---

## 1. What is actually legacy today

`EventResponse` has been frozen since `20260704104842_add_signup_form_tables`.
Nothing in the app writes it: the only writers left are `prisma/seed.ts` and a
test-only Cypress db command. It is read in exactly three places, and every
consumer downstream carries a "legacy" branch because of it.

| Site                                                              | What the legacy handling costs                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/models/event-response.server.ts`                             | The whole file — `countEventResponsesByEvent`, `getEventResponsesForEvent`. `countEventResponsesByEvent` also leaks Prisma's `_count._all` shape into the feature layer (flagged in `docs/app-architecture-review/analysis.md:156`). |
| `app/features/signup-form/read.server.ts`                         | `legacyRowToAttendee`, the `hasLegacyRows` flag, the `DEFAULT_FORM` push into the column union, the extra query in `loadRoster`, the extra query + merge in `getAttendeeCountsForEvents`.                                            |
| `app/features/signup-form/read.server.ts` (`Attendee`)            | `isSigner: boolean \| null` — the `null` case exists *only* to describe legacy rows. Collapses to `boolean`.                                                                                                                        |
| `app/models/form-submission.server.ts` (`eventHasSignups`)        | The `Promise.all` with `prisma.eventResponse.findFirst` collapses to one query.                                                                                                                                                     |
| `app/routes/admin.dinners.$dinnerId_.signups.tsx`                 | The "legacy rows never share a submissionId" caveat in `toParties` goes away.                                                                                                                                                       |
| `prisma/schema.prisma`                                            | The `EventResponse` model and `Event.eventResponses`.                                                                                                                                                                              |
| `cypress/support/upload-test-records.ts`, `upload-test-utils.ts`  | The `create-legacy-response` command that exists purely because the app can't produce these rows anymore.                                                                                                                           |
| `cypress/e2e/admin-form-builder.cy.ts`                            | The mixed legacy + v1 + v2 export assertions.                                                                                                                                                                                      |
| `app/features/signup-form/read.server.test.ts`                    | Three legacy-merge tests.                                                                                                                                                                                                          |
| `prisma/seed.ts`                                                  | Seeds `eventResponse` rows for the demo dinner.                                                                                                                                                                                    |

Adjacent but **separate**: `app/utils/event-signup-validation.ts` +
`app/features/signup-form/parity.test.ts` are the legacy *validation* schema
kept as a regression anchor with its own review date (~2026-10, owner
Benedikt). Backfilling the data does not unblock those; deleting them is an
independent call.

## 2. Why the mapping is easy

`DEFAULT_FORM`'s field names were chosen to equal the `EventResponse` column
names, so the transform is an identity mapping — this is already stated in
`default-form.ts` and implemented in `legacyRowToAttendee`:

```jsonc
// EventResponse row  ->  FormSubmission.answers
{
  "name": row.name,
  "email": row.email,
  "phone": row.phone,
  "vegetarian": row.vegetarian ?? false,  // column is nullable, answers are not
  "student": row.student ?? false,
  "restrictions": row.restrictions ?? "",
  "comment": row.comment ?? "",
  "friends": []                            // see §3.2
}
```

The `?? false` / `?? ""` coercions are not new policy — they are exactly what
`legacyRowToAttendee` prints today and what `normalizeSubmissionValues` stores
for a live signup, so a backfilled row is byte-identical in the CSV.

The hard parts are not the values. They are §3.1–§3.4.

## 3. The four decisions

### 3.1 Which `FormVersion` do backfilled submissions attach to?

`FormSubmission.formVersionId` is non-nullable, so every backfilled row must
point at a version whose schema actually describes its answers.

The tempting answer — "v1, it was backfilled with `DEFAULT_FORM`" — is wrong in
general. `saveFormSchemaInTx` mutates a version **in place** when it has zero
submissions, and legacy `EventResponse` rows are not submissions. So an old
dinner that has only legacy rows can have had its v1 schema edited into
something arbitrary (`admin.dinners.$dinnerId_.edit.tsx`; field *keys* are
locked via `eventHasSignups`, but fields can still be added, removed and
relabelled). Pinning legacy answers to that version would describe them with a
schema they never answered — the CSV union would drop or mislabel their columns.

- **(a) Dedicated archive version, `version = 0`, schema = `DEFAULT_FORM`.**
  Insert one per form that has legacy rows and hang the backfilled submissions
  off it. `version = 0` is the key detail: "current version" is `max(version)`
  everywhere (`CURRENT_FORM_VERSION_ORDER_BY`), so a v0 can never become the
  live form, and the current version keeps its zero-submission in-place
  editability exactly as today. As a bonus the read layer's
  `hasLegacyRows → push(DEFAULT_FORM)` special case disappears for free: v0 is a
  version *with* submissions, so it enters the column union through the normal
  path, sorted last (desc by version) — the same position the legacy fallback
  occupies today.
- **(b) Attach to v1 only if its schema still deep-equals `DEFAULT_FORM`,
  else create an archive version.** Fewer rows, but two code paths and a
  deep-equality check in SQL (or a script) for no real gain.
- **(c) Attach to the current version, whatever it is.** Cheapest, and wrong
  for any dinner whose form was edited. Only viable if a survey shows no such
  dinner exists — and it would still leave a latent trap for the next one.

Recommendation: **(a)**.

### 3.2 One submission per row, or reconstruct parties?

The legacy write path fanned a party out into one `EventResponse` per attendee
in a single transaction, copying the signer's email and phone onto each row.
"Who signed up with whom" was never recorded.

- **(a) 1 row → 1 submission, `friends: []`.** Every backfilled attendee is its
  own party of one. This is *exactly* what the admin table and CSV show today
  (`toParties` already treats each legacy row as a party of one), so the
  observable output is unchanged. Trivially verifiable, trivially idempotent.
- **(b) Reconstruct parties** by grouping on `(eventId, email, phone)` plus
  createdAt proximity, then picking a signer (id order — Prisma cuid v1 is
  timestamp+counter prefixed, so it roughly tracks insert order within a
  process). This *invents* data: two genuinely separate signups from the same
  person at the same dinner merge into one party, and the signer pick is a
  guess. It also changes what the admin table shows for historical dinners.

Recommendation: **(a)**. If party structure for old dinners is genuinely
wanted, it is a separate, opt-in exercise with a human reviewing the groupings —
not something to smuggle into a code-removal migration.

### 3.3 Timestamps and ids

- `FormSubmission.createdAt` is `@default(now())` with no `@updatedAt`, so it is
  writable. It **must** be set from `EventResponse.createdAt` — the roster sorts
  by it and the admin table renders it as "Signed up".
- SQLite cannot mint cuids, so a pure-SQL migration derives ids from the source
  row, following the precedent already set by
  `20260704104842_add_signup_form_tables` (`'form_' || "id"`). Use
  `'formsubmission_' || "id"` and `'formversion_legacy_' || "formId"`. Derived
  ids make the backfill idempotent (`INSERT OR IGNORE` / `WHERE NOT EXISTS`)
  and make a row-for-row audit a join instead of a heuristic.

### 3.4 Drop the table, or keep it cold?

- **Drop it** in the same change set that removes the read path. Clean, and the
  data lives on in `FormSubmission` — plus nightly NAS backups and 60-day Fly
  volume snapshots (`docs/database-backups/plan.md`) hold the pre-migration
  state.
- **Keep it** as a cold archive, unreferenced by Prisma. Costs nothing on a
  SQLite file, but leaving a table Prisma no longer models means the next
  `migrate diff` wants to drop it anyway. Half-measure.

Recommendation: drop it, in a *separate later migration* (see §5).

## 4. Where the transform runs

### Option A — pure SQL migration

One hand-written migration under `prisma/migrations/`, on the model of
`20260704104842_add_signup_form_tables` (which already embeds the `DEFAULT_FORM`
JSON as a literal and derives ids from the source row).

```sql
INSERT INTO "FormVersion" ("id","version","schema","createdAt","updatedAt","formId")
SELECT 'formversion_legacy_' || e."formId", 0, '<DEFAULT_FORM json>',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, e."formId"
FROM "Event" e
WHERE EXISTS (SELECT 1 FROM "EventResponse" r WHERE r."eventId" = e."id");

INSERT INTO "FormSubmission" ("id","answers","createdAt","formVersionId")
SELECT 'formsubmission_' || r."id",
       json_object('name', r."name", 'email', r."email", 'phone', r."phone",
                   'vegetarian', json(CASE WHEN COALESCE(r."vegetarian",0) THEN 'true' ELSE 'false' END),
                   'student',    json(CASE WHEN COALESCE(r."student",0)    THEN 'true' ELSE 'false' END),
                   'restrictions', COALESCE(r."restrictions",''),
                   'comment',      COALESCE(r."comment",''),
                   'friends', json('[]')),
       r."createdAt", 'formversion_legacy_' || e."formId"
FROM "EventResponse" r JOIN "Event" e ON e."id" = r."eventId";
```

- **+** Runs automatically on deploy (`start.sh` → `prisma migrate deploy`),
  atomically, before the new server code serves a request. Nobody has to
  remember to run anything. Same mechanism that already backfilled every form.
- **+** No dependency on application code that is about to be deleted.
- **−** The `DEFAULT_FORM` blob is duplicated as a literal (again). It is
  frozen history, so drift is not a real risk, but it is 1 KB of JSON in a
  `.sql` file with no `FormSchema` validation.
- **−** SQLite's `json_object` needs the `json(...)` wrapping dance for real
  booleans; get it wrong and you store the strings `"true"`/`"false"`, which
  `flattenSubmission` will accept silently and the CSV will render identically.
  **This needs a test against a copy of the prod DB**, not a code review.

### Option B — one-off TypeScript script

`scripts/backfill-legacy-signups.ts` (there is already a `scripts/` dir and
`tsx` is a dependency), run once via `fly ssh console`.

- **+** Imports `DEFAULT_FORM` and validates through `FormSchema` /
  `parseStoredFormSchema` — no duplicated literal, no hand-rolled JSON.
- **+** Can log a per-dinner before/after roster diff as it goes, and be run in
  a `--dry-run` mode first.
- **−** Someone has to actually run it on prod, in the right order relative to
  the deploy that removes the read path. That ordering is a footgun the
  migration mechanism otherwise handles for us.
- **−** The script must be deleted afterwards or it rots against a schema that
  no longer has `EventResponse`; and it has to be written *before* the model
  file is deleted.

### Option C — script-shaped migration

Prisma has no TS migrations, but the script can be invoked from `start.sh`
before `migrate deploy`, guarded by a marker row. This gets Option B's
validation with Option A's automatic ordering, at the cost of permanently
complicating the entrypoint for a one-time event. Not worth it here.

### Option D — no backfill at all

Delete the legacy read path, export a CSV per affected dinner as a cold
archive, and let the rows die with the table.

- **+** By far the least work; deletes everything in §1 in one PR.
- **−** Historical dinners silently lose their attendee lists in the admin UI
  and the seat counts on `/admin/dinners` change. Only defensible if the survey
  in §5.0 shows the affected rows are demo/junk data.

Recommendation: **A** for the data (it is history, written once, verified
against a DB copy), or **B** if the survey turns up anything irregular that
wants per-row judgement. Do not pick D without looking at the data first.

## 5. Sequencing

**5.0 Survey first** (before choosing anything): on a copy of the prod DB,
count `EventResponse` rows, how many dinners they span, how many of those
dinners already have `FormSubmission`s, and — the load-bearing question for
§3.1 — how many of their forms have a v1 whose schema no longer deep-equals
`DEFAULT_FORM`. This is a 10-minute query and it collapses most of the option
space above.

Then, deliberately **two** deploys:

1. **Backfill only.** Migration lands, legacy read path still in place. It now
   double-counts: `loadRoster` returns each attendee once from `EventResponse`
   and once from `FormSubmission`.
   → so the backfill migration and the read-path removal **cannot** be split
   across deploys naively. Two ways out:
   - **1a.** Backfill + read-path removal in one deploy; drop the table in a
     later one. The table survives as the rollback path, and rollback is a
     code revert, not a data restore. **This is the recommended split.**
   - **1b.** Truly stage it by having the backfill migration also delete the
     `EventResponse` rows it copied (same transaction). One deploy, no
     double-count window, no rollback path except the nightly backup.
2. **Drop the table** in a follow-up migration once a real export has been eyeballed.

**Verification** for either: on a copy of prod, byte-compare `signups.csv` for
every dinner before and after the migration, and compare
`getAttendeeCountsForEvents` output. If the CSVs are identical, the backfill is
correct by construction — that is precisely what the roster contract promises.

## 6. What the read layer looks like afterwards

```ts
export interface Attendee {
  submissionId: string;
  isSigner: boolean; // no more null
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string | boolean>;
  createdAt: Date;
}
```

`loadRoster` loses a query and a merge; `getAttendeeRosterForEvent` loses the
`hasLegacyRows` branch (keeping only the "no submissions at all →
current version → `DEFAULT_FORM`" fallback, which is about empty dinners, not
about legacy); `getAttendeeCountsForEvents` loses a query and a loop;
`eventHasSignups` becomes a single `findFirst`; `event-response.server.ts`,
the Cypress `create-legacy-response` command and the `EventResponse` model are
deleted outright.
