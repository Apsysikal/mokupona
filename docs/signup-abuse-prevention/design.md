# Signup Abuse Prevention — Design

**Status:** Research complete, recommendations proposed — not yet approved
**Last updated:** 2026-07-30

Follow-up to the admin self-signup toggle (#421). That toggle is a kill switch: it
closes the door entirely. This document covers what to do while the door is _open_.

---

## 1. The finding that reframes everything

**better-auth's captcha plugin and its built-in rate limiter cannot see this app's
signup form.** Both are wired into the HTTP router, and every auth flow in this
codebase bypasses the router.

Verified against the installed `better-auth@1.6.25` source:

- `plugin.onRequest` — where the **captcha plugin** and `onRequestRateLimit` both
  live — is invoked only from `createRouter(...)` inside `router()`
  (`dist/api/index.mjs:163-178`).
- `router()` is constructed only inside `handler`. `auth.api` is built separately
  from `getEndpoints()` and never touches it (`dist/auth/base.mjs`).
- `options.hooks.before` / `plugin.hooks.before` run inside `dispatchAuthEndpoint`,
  which `toAuthEndpoints` wraps around **every** endpoint — so those _do_ fire for
  direct `auth.api.*` calls.

better-auth's own docs state the same for rate limiting: _"Server-side requests made
using `auth.api` aren't affected by rate limiting."_

| Extension point                                   | Runs in                            | Reaches `/join`? |
| ------------------------------------------------- | ---------------------------------- | ---------------- |
| `plugin.onRequest` (captcha plugin, rate limiter) | `auth.handler()` only              | **No**           |
| `options.hooks.before`                            | every endpoint, incl. `auth.api.*` | **Yes**          |

Every unauthenticated auth flow we have calls `auth.api.*` directly:

| Flow            | Call site                           |
| --------------- | ----------------------------------- |
| Email signup    | `app/routes/join.tsx:83`            |
| Invite signup   | `app/routes/invite.$token.tsx:162`  |
| Login           | `app/routes/login.tsx`              |
| Forgot password | `app/routes/forgot-password.tsx:31` |
| Reset password  | `app/routes/reset-password.tsx`     |

**Consequences:**

1. Adding `captcha({...})` would protect nothing that matters. It would appear to
   work when tested against `/api/auth/*` and do nothing for the actual form.
2. We have **zero rate limiting today** — not the defaults one might assume. Had we
   been on the router path, better-auth would already cap `/sign-up` at 3 requests
   per 10s and `/request-password-reset` at 3 per 60s. None of it applies.
3. Our forms are progressively-enhanced HTML `<Form>`s. A captcha token arrives as a
   form **field** (`cf-turnstile-response`, `altcha`), not as the
   `x-captcha-response` **header** the plugin reads. The plugin is the wrong shape
   for this app regardless of where it runs.

Integration point for anything that must cover the real flows: **the route action**
(explicit, per-route) or **`options.hooks.before`** (uniform, catches routes we
forget). Not the plugin.

---

## 2. Threat model

What abuse of `/join` actually costs us:

- **Junk `User` rows.** Low impact — `requireEmailVerification: true` means an
  unverified account can do nothing.
- **Resend quota and sender reputation.** Each signup sends a verification mail.
  This is the real cost.
- **Third-party mail bombing.** An attacker signs up as `victim@example.com`; the
  victim receives mail from us. Repeatable across many addresses. This is the most
  serious item and the one rate limiting addresses directly.
- **Account enumeration** (adjacent, pre-existing): `join.tsx:61` answers "an account
  already exists with this email", and the existing-user check runs before any other
  validation. Anyone can test address membership. Worth fixing while we are here.

Who we are actually defending against: broad-spectrum scrapers and script kiddies.
A community dinner site is not a high-value target. This argues for cheap,
low-friction, high-coverage measures — and against anything that taxes real users.

---

## 3. Options assessed

### 3.1 Honeypot field

**Effectiveness:** kills naive HTTP form-fillers, which are the bulk of volume spam.
Does not stop scripted headless browsers, LLM-driven agents (which read the
accessibility tree and never see an `aria-hidden` field), or human farms. A volume
filter, not a security control.

**Best practice:**

- Name it something plausible that field-name heuristics _want_ to fill
  (`name__confirm`), never `honeypot`/`hp`/`website` — those are on skip-lists.
  Prefer our own string over any library default.
- Hide via a class in `tailwind.css` (`position:absolute; left:-9999px`), **not** an
  inline `<style>` — an inline style block is a CSP hazard.
- `aria-hidden="true"` on the wrapper plus `tabindex="-1"` on the input, or screen
  reader and keyboard users hit an invisible field.
- `type="hidden"` catches nothing; every bot skips hidden inputs.

**The real risk is password managers**, which fill fields they recognise and are the
documented #1 cause of honeypots blocking humans. `autocomplete="off"` is not enough.
Needs the per-vendor opt-outs: `data-1p-ignore`, `data-lpignore`, `data-bwignore`,
`data-form-type="other"`, `data-protonpass-ignore`.

**Conform pitfall:** `parseWithZod` coerces `""` to `undefined`, so a
`z.literal("")` check in the schema fails for every legitimate user. Check the
honeypot on raw `FormData` **before** `parseWithZod`.

**Privacy:** essentially nil. The field is empty by design, first-party, no cookie,
no third party. Only the abuse log carries personal data (IP) — Art. 6(1)(f),
Recital 49, short retention.

### 3.2 Timing detection

**Effectiveness:** catches bots that POST in the same tick as the page fetch. A bot
that waits 4 seconds passes trivially. Another cheap volume filter.

**Only the server-issued signed-timestamp variant is worth building.** A client-side
JS timer ships an attacker-controlled number in the POST body.

- **Threshold: 2s minimum.** Four fields including a typed-twice password. Products
  in the wild default to 2s (WPForms). Do not exceed 3s.
- **Max age: 24h, and re-issue rather than reject on expiry.** A tab left open over
  lunch is normal. The max age exists to bound replay, not to catch bots.
- **Sign with HMAC-SHA256**, key derived via HKDF from `BETTER_AUTH_SECRET`. Never a
  per-process random seed — a Fly rolling deploy would break every open tab.
- **Replay is the real weakness.** Harvest one token, reuse forever. Mitigate with a
  nonce in the signed payload, recorded on successful use (`UsedFormToken` table with
  a unique constraint). Writes then scale with submissions, not page views. Do not
  bind to IP — mobile networks rotate.

**SSR/caching pitfalls checked against this repo — we are clear.** No `prerender` in
`react-router.config.ts`, no CDN HTML caching (Fly serves `react-router-serve`
directly). Rule going forward: issue the token in the **`/join` route loader**, not
the root loader, and never compute it in render.

**Privacy:** nil. Two timestamps and their difference, nothing stored, no cookie.

### 3.3 remix-utils `Honeypot` — do not adopt wholesale

Widely recommended, and its `validFromFieldName` is widely described as a speed trap.
**It is not.** Verified directly against the source:

- `check()` enforces **no minimum fill time** and **no maximum age**. It only rejects
  timestamps in the future. A submission 0ms after render passes.
- `shouldCheckHoneypot()` returns false — and `check()` **passes silently** — when
  neither field is present in the FormData. A bot posting a bare
  `name`/`email`/`password` body opts out of the entire mechanism.
- `decrypt()` is not wrapped in `try/catch` inside `check()`; garbage in the field
  throws a raw Web Crypto `OperationError` → 500, not `SpamError`.
- Default `encryptionSeed` is random **per process** — breaks on every deploy.

It is maintained and RR8-compatible (v10.0.0, June 2026, peers `react-router@^8`).
But since we would be hand-rolling the timing check anyway, adopting its field and
bolting a second timing check on top is _more_ code than writing ~60 lines ourselves.

**Whatever we build, a missing token must be a hard failure, not a skip.** That is
the single most important line.

### 3.4 CAPTCHA

Only worth reaching for if §3.1–3.3 plus rate limiting prove insufficient. Ranked
for a German/EU site:

|                          | Free tier         | Third-party script | Cookies / consent        | Notes                                                            |
| ------------------------ | ----------------- | ------------------ | ------------------------ | ---------------------------------------------------------------- |
| **ALTCHA** (self-hosted) | Free, MIT         | **None**           | None                     | Zero compliance surface. WCAG 2.2 AA + EAA. No reputation layer. |
| **Turnstile**            | Free, unlimited   | Yes                | No consent hook          | Pragmatic managed option. See caveat below.                      |
| **hCaptcha**             | Free              | Yes                | Some configs set cookies | DPA with SCCs included.                                          |
| **reCAPTCHA**            | 10k/mo, then paid | Yes                | **Consent required**     | Avoid.                                                           |

- **reCAPTCHA is a non-starter here.** German authorities treat its cookies as
  non-essential, so § 25 TDDDG requires prior opt-in — the captcha could not load
  until the user accepted a banner. Plus US transfer post-_Schrems II_ and a GCP
  billing account.
- **Turnstile caveat:** Cloudflare's Turnstile Privacy Addendum positions Cloudflare
  as a **controller** for some Turnstile data, so the standard Art. 28 processor DPA
  does not cleanly cover it. Not fatal; a real asterisk for the
  Verarbeitungsverzeichnis.
- **ALTCHA is the only option with genuinely no third party**, no DPA, no privacy
  policy addition beyond a sentence. Proof-of-work stops cheap volume, not a
  determined attacker who pays the compute. For this site that is the right trade.

Either way: verify in the action against the form field. Not the plugin.

---

## 4. Recommendation

Rate limiting is the highest-value item and the one we are missing entirely. The
honeypot and timing checks are cheap, compose well, and share a token — build them
together. CAPTCHA is deferred until we have evidence the first three are insufficient.

### Order of implementation

**Phase 0 — close the holes we already have** _(small, do first)_

1. **Reject `/api/auth/sign-up/email` unconditionally** in `app/routes/api.auth.$.ts`.
   Verified safe: all three `signUpEmail` call sites are server-side
   (`join.tsx:83`, `invite.$token.tsx:162`, `create-user.server.ts:27`), and the only
   client-side better-auth calls are `signIn.social` and `linkSocial`. Nothing
   legitimate posts there. Today it is an unprotected signup path that no honeypot on
   `/join` would cover — currently gated only while the toggle is off.
2. **Persist the signup toggle.** `signup-settings.server.ts` keeps it in an
   in-memory `singleton()`. It resets to _all enabled_ on every deploy and restart,
   and is per-instance if we ever scale past one Fly machine. The kill switch
   silently re-opens itself. Move it to the database.
3. **Stop leaking account existence** at `join.tsx:61` — respond identically whether
   or not the address is registered.

**Phase 1 — rate limiting** _(highest value)_

Per-IP **and** per-email-address limits on `/join`, `/forgot-password`, `/login`.
Per-email matters specifically for the mail-bombing case. Suggested starting points:
5 signups/hour/IP, 3 password resets/hour/IP, 3 mails/day/address.

Implement at the route-action layer via a shared helper, or in `options.hooks.before`
if we want uniform coverage of flows we might add later. `hooks.before` also fires for
the invite and admin-create paths, which need exempting — the explicit per-route
helper is clearer and is what I would start with.

Storage: SQLite via Prisma is fine on a single Fly machine. Revisit if we scale out.

**Phase 2 — honeypot + timing** _(one change, shared token)_

Both checks read from one signed token issued in the `/join` loader. Roughly:
`app/features/auth/form-protection.server.ts` (~60 lines), a
`<HoneypotInput>` component, one `tailwind.css` rule, wire-up in `join.tsx`, and the
same on the public dinner signup form.

Non-negotiables from the research:

- Check on raw `FormData` before `parseWithZod`.
- Missing token = failure, not skip.
- Password-manager opt-out attributes on the trap field.
- Bypass keyed off the existing `CYPRESS_SUPPORT` flag, or the e2e suite goes red.
- **Ship in shadow mode.** Log `elapsedMs` and every trip for two weeks, look at the
  p1 of successful signups, then enforce. Picking a threshold blind is how you lose
  real signups silently.

Failure handling, split by check:

- **Honeypot trip → fake success.** Redirect to `/check-your-inbox` without creating
  the user or sending mail. The bot learns nothing and cannot iterate on the trap.
- **Timing trip → real, friendly error** and a fresh token. Timing false positives are
  more plausible and are recoverable by retrying; a silent drop there would churn real
  users invisibly.

Log every trip at `warn` with IP and obscured email so a false-positive spike
(a browser or password-manager update) is visible rather than silent.

**Phase 3 — CAPTCHA, only if needed**

Revisit with data from Phase 2's logs. If spam persists, self-hosted ALTCHA verified
in the action. Turnstile if we want a managed reputation layer and accept documenting
the legitimate-interest basis.

### What we are relying on that already works

`requireEmailVerification: true` with `sendOnSignUp: false` means an unverified spam
account can do nothing. That is doing more work than any of the above and should not
be relaxed.

---

## 5. Sources

better-auth behaviour in §1 was verified against the installed `better-auth@1.6.25`
in `node_modules`, not only the docs (the rate-limit docs state a 60s default window;
the source says 10s). The remix-utils findings in §3.3 were verified against
`sergiodxa/remix-utils` `main`.

- better-auth [captcha plugin](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/captcha/index.ts) ·
  [router/onRequest](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/api/index.ts) ·
  [handler vs api](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/auth/base.ts) ·
  [rate limit docs](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/rate-limit.mdx)
- [remix-utils `honeypot.ts`](https://github.com/sergiodxa/remix-utils/blob/main/src/server/honeypot.ts) ·
  [issue #332 — autocomplete](https://github.com/sergiodxa/remix-utils/issues/332)
- [Epic Stack `honeypot.server.ts`](https://github.com/epicweb-dev/epic-stack/blob/main/app/utils/honeypot.server.ts)
- [Conform `parseWithZod`](https://conform.guide/api/zod/parseWithZod) (empty-string coercion)
- [Marek Tóth — password manager autofill](https://marektoth.com/blog/password-managers-autofill/)
- [IT-Recht Kanzlei — reCAPTCHA Einwilligungspflicht](https://www.it-recht-kanzlei.de/google-recaptcha-einwilligungspflicht.html) ·
  [captcha.eu — Is Turnstile GDPR-compliant?](https://www.captcha.eu/is-cloudflare-turnstile-gdpr-compliant/)
- [ALTCHA](https://github.com/altcha-org/altcha) · [Cloudflare Turnstile GA](https://blog.cloudflare.com/turnstile-ga/)
