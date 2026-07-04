# Customizable Signup Form — Agent Session Plan

Companion to [`design.md`](./design.md) and [`implementation-plan.md`](./implementation-plan.md). Splits the four phases into **seven sequential agent sessions** (plus one recurring session shape for Phase 3). Each session ends at a checkpoint where the app is fully working, `npm run typecheck && npm run test && npm run lint` are green, and the diff is committed — so any session can be the last one shipped.

## Protocol (every session)

1. **Start:** read `design.md`, `implementation-plan.md`, and this file. Check the status table below for where the previous session left off and any deviation notes.
2. **Scope discipline:** do only this session's items. If you discover work that belongs to a later session, add a note under _Deviations & discoveries_ — do not do it.
3. **End:** all checks green, work committed on `dev`, tick the status row, and record deviations/discoveries below.
4. Commits are the state carrier between sessions; this doc is the coordination carrier — commit its status updates alongside the session's work.

## Status

| #   | Session                                            | Phase        | Status |
| --- | -------------------------------------------------- | ------------ | ------ |
| 1   | Branch cleanup + generic forms library             | cleanup + 0a | ☑      |
| 2   | Signup page renders via registry (old storage)     | 0b           | ☑      |
| 3   | Storage: schema, migration, backfill, models       | 1a           | ☐      |
| 4   | Attendee read layer + admin/CSV switch             | 1b           | ☐      |
| 5   | Write-path switch to FormSubmission                | 1c           | ☐      |
| 6   | Admin builder UI — core                            | 2a           | ☐      |
| 7   | Builder guardrails + full e2e sweep                | 2b           | ☐      |
| 8+  | New field types (one session each, `select` first) | 3            | ☐      |

## Deviations & discoveries

_(append here, newest first, prefixed with the session number)_

- **S2:** `zodForField` gained user-facing error messages derived from the label (`${label} is required`; email format errors say `${label} is invalid`). Without them the registry-driven page would show zod's raw "expected string, received undefined" where the live form said "Name is required". Deliberate message change: a _malformed_ (not missing) email now reads "Email is invalid" instead of the legacy quirk "Email is required".
- **S2:** Conform's coercion strips **unchecked optional checkboxes from the parse output entirely** — the `.default(false)` in `zodForField` never runs under `parseWithZod` (it does under plain `.parse`, which is what the unit tests exercise). The route's temporary adapter schema re-applies `.default(false)` before the `createEventResponse` fan-out. **Session 5 must keep an equivalent normalization when writing `FormSubmission.answers`** (store explicit `false`, not absent keys) or teach the read layer to treat absence as false.
- **S2:** The empty-list case from the S1 note is confirmed end-to-end: `parseWithZod` yields `friends: []` when no friend inputs are submitted (parity test) and the solo-signup e2e passes.
- **S2:** The loader key for the descriptors is `formFields` (not `form`) — `form` collides with Conform's form object in the component. Session 5's loader should keep that name and add `formVersionId`.
- **S2:** Incidental fix: the failed-submission log's `submission.payload["email"]` lookup now actually finds the email — under the legacy schema the payload key was `signupPerson.email`, so that log line always recorded `unknown@no-domain.com`.

- **S1 (review):** `ListField` reads the form metadata via Conform's `useFormMetadata()` context instead of a `formMetadata` prop, so every field view shares the `{fieldConfig, fieldMetadata}` contract and the type-erased registry can't hide a missing prop. **Session 2's route must wrap the rendered fields in `<FormProvider context={form.context}>`.**
- **S1 (review):** `buildSubmissionSchema` now maps `required: true` on a list to `.min(1)`; previously the flag was silently ignored for lists.
- **S1 (review):** `SignupFormSchema` pins the identity fields' types (`name`=text, `email`=email, `phone`=phone) and carries its own `MAX_FRIENDS_COUNT = 10` so raising the generic `MAX_LIST_COUNT` never loosens the signup profile.
- **S1 (review, deferred):** `ListField`'s default layout classes (`gap-20` etc.) mirror the signup page; if a non-signup consumer ever needs different layout, expose className/slot overrides then rather than speculatively now.

- **S1:** The signup route was not restored to main's literal file — main is on react-router 7, the branch on v8. Behavior, schema, action, and JSX match main exactly; only the v8 type adaptations were kept (`Route.ComponentProps` props instead of hooks, `loaderData` in meta args, no `invariant` on typed params), plus the branch's fix of main's copy-paste bug where a friend's Student checkbox displayed `alternativeMenu.errors`.
- **S1:** The "drop the `createEventResponse` object-arg refactor" item was a no-op — `app/models/event-response.server.ts` has no diff vs main (the refactor was already reverted before this session).
- **S1:** `zodForField` and the non-list descriptor union/views live in `app/features/forms/fields/non-list.ts` (re-exported from `fields/index.ts`) rather than in `index.ts` itself, so the `list` field's model/view can import them without an import cycle.
- **S1:** Conform's zod integration coerces a missing field-list to `[]` at parse time, but plain `schema.parse` does not — a submission missing the `friends` key fails `buildSubmissionSchema` validation. Irrelevant while unconsumed; Session 2's route (which uses `parseWithZod`) should confirm the empty-list case end-to-end.

---

## Session 1 — Branch cleanup + generic forms library (Phase 0a)

The library exists and is correct; the public page is temporarily reverted to main's known-good version so nothing user-visible depends on the new code yet.

- All of "Branch cleanup" from the implementation plan: delete `scope`/`FieldScope`, rename descriptor key `id` → `name`, fix `default-form.ts` (structure per design §5.1; `studen`→`student`, `alternate_menu`→`vegetarian`, `diet_restrictions`→`restrictions`), revert `acceptPrivacy`→`acceptedPrivacy` rename, drop the `createEventResponse` object-arg refactor.
- Move generic parts to `app/features/forms/` (fields, registry, bounds, serialization); signup-specific parts stay in `app/features/signup-form/`.
- Implement the `list` field type (`model.ts` + `view.tsx`, design §4.1).
- Implement `buildSubmissionSchema`, bounds (`MAX_TOTAL_FIELDS`, `MAX_LIST_COUNT`, per-scope name uniqueness, cross-scope same-name ⇒ same-type, design §4.2).
- `SignupFormSchema` profile refinements + `buildSignupSchema` (design §5, §6.1).
- **Restore [`app/routes/dinners_.$dinnerId.tsx`](../../app/routes/dinners_.$dinnerId.tsx) to main's version** (`git show main:...`) — the branch copy is broken against the new schema; the registry-driven rewrite is Session 2's job.
- Unit tests: `zodForField` per type; `buildSubmissionSchema` (top-level + list, `maxCount` incl. 0); `FormSchema` bounds; `SignupFormSchema` profile.

**Acceptance:** checks green; public signup page behaves exactly as on `main`; the new library is complete and unit-tested but unconsumed by routes.

## Session 2 — Signup page renders via registry, old storage (Phase 0b)

- Rewrite the signup route: loader supplies `DEFAULT_FORM`, registry-driven render (incl. the friends `list`), `buildSignupSchema` for client + server validation.
- Temporary adapter in the action: map `{…, friends: […]}` onto today's per-attendee `createEventResponse` fan-out (friends inherit signer email/phone, as now).
- Privacy checkbox + submit button hardcoded after mapped fields (design §6.2).
- Parity test: `DEFAULT_FORM` ⇔ [`event-signup-validation.ts`](../../app/utils/event-signup-validation.ts).
- E2E: default signup, add-a-friend, validation errors.

**Acceptance:** Phase 0 acceptance — page functionally identical, data written identically, checks green.
**Rollback:** revert route to main's JSX.

## Session 3 — Storage: schema, migration, backfill, models (Phase 1a)

Purely additive; no consumer changes, nothing user-visible.

- Prisma: `Form`, `FormVersion`, `FormSubmission`, non-null unique `Event.formId` (design §3).
- Migration backfills one `Form` + `FormVersion` v1 (`DEFAULT_FORM`) per existing event, then makes `formId` non-nullable (design §3.1). Verify against a copy of a realistic DB.
- `app/models/form.server.ts`: current-version lookup, §9 versioning policy (deep-equal skip / in-place while unsubmitted / new version).
- `app/models/form-submission.server.ts`: `createFormSubmission`, submissions-for-event query.
- `app/models/event.server.ts`: create form inside event creation; app-level cascade delete transaction (design §3.2).
- Seeds + test factories create forms with events.
- Unit tests: versioning policy; event create/delete round-trips form rows.

**Acceptance:** migration runs cleanly; every event has a form; new tables sit unused; checks green.

## Session 4 — Attendee read layer + admin/CSV switch (Phase 1b)

Reads switch **before** writes so there is never a window where new signups are invisible to admins. With only legacy rows in the DB, output must be identical to today.

- `app/features/signup-form/read.server.ts`: `getAttendeesForEvent` + `Attendee` (flattening, submission-level replication, legacy merge with `isSigner: null` — design §8).
- Switch [`admin.dinners.$dinnerId_.signups.tsx`](../../app/routes/admin.dinners.$dinnerId_.signups.tsx) and [`admin.dinners.$dinnerId.[signups.csv].tsx`](../../app/routes/admin.dinners.$dinnerId.[signups.csv].tsx) to consume `Attendee[]` (CSV: name-keyed column union across versions with submissions, headers from latest labels).
- Unit tests: flattening, replication rule, legacy merge; also cover a synthetic `FormSubmission` even though production writes don't exist yet.

**Acceptance:** admin table and CSV identical to today for existing data; read-layer unit tests also pass for new-format submissions; checks green.

## Session 5 — Write-path switch to FormSubmission (Phase 1c)

The one risky flip, kept deliberately small.

- Loader passes the current `FormVersion`'s descriptors + version id; schema memoized on `formVersionId`.
- Action re-reads the current version from DB, rebuilds the schema, strips `acceptedPrivacy`, writes **one** `FormSubmission` (design §7). Drop the Session-2 adapter; `EventResponse` writes stop.
- E2E: new signup (solo + with friends) appears in admin table and CSV alongside legacy rows.

**Acceptance:** Phase 1 acceptance; checks green.
**Rollback:** restore the Session-2 adapter action.

## Session 6 — Admin builder UI, core (Phase 2a)

- "Signup form" section in [`admin-dinner-form.tsx`](../../app/components/admin-dinner-form.tsx): Conform field array of descriptor rows (type select, label, required, up/down reorder); friends list pinned with editable `itemFields` + `maxCount` 0–10; `name`/`email`/`phone` pinned (design §10).
- Field keys slug-derived from label on add, captioned "Field key"; duplicate/over-budget rejected client-side.
- Event create/edit actions validate with `SignupFormSchema` and persist via the §9 versioning policy.
- E2E: builder round-trip (create/edit form, reload shows it); a custom field round-trips signup → admin → CSV.

**Acceptance:** organizers can author custom forms end-to-end; checks green.
**Rollback:** hide the builder section.

## Session 7 — Builder guardrails + full e2e sweep (Phase 2b)

- Sync nudge: "also ask this for each friend?" twin creation (same `name` + type), and vice versa.
- Field keys immutable once submissions exist (UI enforcement; server already validates via versioning policy).
- Warn before removing a field with responses; "Reset to default".
- Remaining e2e from the cross-cutting list: friends disabled (`maxCount: 0`) end-to-end; editing a form with submissions creates a new version and old submissions still export; CSV with mixed legacy + multi-version rows.

**Acceptance:** Phase 2 acceptance in full; checks green.

## Sessions 8+ — Phase 3, one field type per session

Template per type (`select` first, then `number`, `date`, … on demand): one folder (`model.ts` + `view.tsx`), registry entry, `zodForField` case, builder support (e.g. options editor with an option-count bound for `select`), unit tests, one e2e touch. No migration. Data-shape changes get a new `version` literal + upconverter, never in-place edits (design §4).
