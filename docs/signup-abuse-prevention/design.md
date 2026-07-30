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
2. **None of our user-facing flows are rate limited.** The built-in limiter does run
   for the `/api/auth/*` catch-all in production (3 requests/10s on `/sign-up`,
   3/60s on `/request-password-reset`) — but that is the path nothing legitimate
   uses. `/join`, `/login` and `/forgot-password` get nothing. See also §5 on why
   that `/api/auth/*` cap may be a single site-wide bucket on Fly.
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
- **Account enumeration** (adjacent, pre-existing): `join.tsx:54` answers "an account
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

1. **Reject `POST /api/auth/sign-up/email` unconditionally** in
   `app/routes/api.auth.$.ts`. better-auth's own registration endpoint, exposed
   because the catch-all forwards every route it mounts (we need the catch-all for
   the Google flow). Today it is blocked **only while the toggle is off** — so in
   normal operation it is a live signup path that skips `join.tsx` entirely: no
   existing-user check, no logging, and no honeypot or timing check we add later.

   Verified safe to close: all three `signUpEmail` call sites are server-side
   (`join.tsx:83`, `invite.$token.tsx:162`, `create-user.server.ts:27`), and the only
   client-side better-auth calls are `signIn.social` and `linkSocial`.

   **The risk is address squatting, not mail-bombing.** With `sendOnSignUp: false` a
   direct POST creates an unverified `User` row and sends no mail — but `join.tsx:54`
   then reports "an account already exists with this email", so burning a list of real
   addresses permanently locks those people out of signing up. Silent, no outbound
   mail, discovered only when someone complains.

   Neither existing control helps. `formCsrfMiddleware` validates the origin only when
   a cookie, a `Sec-Fetch-*` header, or `Origin`/`Referer` is present; a bare scripted
   POST has none and falls through — correct for CSRF, worthless against bots. The
   built-in rate limiter does apply here (3/10s), which is ~18/min: ample for squatting,
   and possibly a site-wide shared bucket on Fly (§5).

2. **Stop leaking account existence** at `join.tsx:54` — respond identically whether
   or not the address is registered.

_Not included:_ the in-memory signup toggle in `signup-settings.server.ts` is a
deliberate choice. It resets to _all enabled_ on every deploy and restart, and is
per-instance if we scale past one Fly machine — accepted as an ephemeral brake rather
than a durable setting.

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

## 5. Considered: moving `/join` to the better-auth client

If `/join` called `authClient.signUp.email()` from the browser instead of posting to a
React Router action, the request would go through `/api/auth/*` → `auth.handler()` →
the router, and §1 would no longer apply. Worth taking seriously, since it is the
configuration better-auth's own docs assume. Assessed below; **recommendation is not
to switch, for abuse-prevention reasons alone.**

### What we would gain

- **The captcha plugin works.** Token passed as `x-captcha-response` via
  `fetchOptions.headers`. Protects `/sign-up/email`, `/sign-in/email` and
  `/request-password-reset` out of the box.
- **Built-in rate limiting works**, with no code: 3 requests/10s on `/sign-up`, 3/60s
  on `/request-password-reset`.
- **Honeypot and timing stay available.** `signUpEmailBodySchema` ends in
  `.and(z.record(z.string(), z.any()))`, so extra body fields are accepted and
  ignored (only keys declared in `user.additionalFields` are persisted). The trap
  field can ride along in the body and be checked in `hooks.before`.

### What we would lose or have to rebuild

1. **Progressive enhancement.** Signup would require JS, and `/join` becomes the only
   form in the app that does.
2. **The manual verification-mail flow.** `join.tsx` sends the verification mail
   itself with a custom `callbackURL`, precisely because `sendOnSignUp: false` keeps
   the invite flow from sending one (`auth.server.ts:83-86`). Flipping
   `sendOnSignUp: true` would fire for the invite flow too, since both paths hit the
   same endpoint. A path-based `hooks.after` does not separate them either — it runs
   for `auth.api.*` calls as well. The only discriminator is whether `ctx.request`
   exists, which the docs describe as "may not exist in server-only endpoints" —
   workable, but leaning on an implementation detail for correctness of who gets mail.
3. **The Conform error pipeline.** Server errors currently return as a
   `SubmissionResult` via `submission.reply()`. Client-side we would get better-auth
   error codes as JSON and have to map them back into Conform's error state by hand,
   losing the single validation path.
4. **Account enumeration is not fixed** either way — better-auth returns
   `USER_ALREADY_EXISTS`.

### The two findings that decide it

**The built-in limiter is IP-keyed only.** `createRateLimitKey(ip, path)` — and
`customRules` adjust only `window`/`max`, never the key. It cannot express _"3 mails
per day to this address"_, which is exactly the limit that stops a specific victim
being mail-bombed (§2). We would end up hand-rolling the per-email limit regardless,
which is most of the work we were trying to avoid.

**On Fly, the built-in limiter is a self-DoS risk until configured.** `getIp` defaults
to `ipAddressHeaders: ["x-forwarded-for"]`, and `getIPFromHeader` returns `null` for a
multi-entry header unless `trustedProxies` is set. Fly forwards a chain. With no IP,
the key falls back to a single shared `"no-trusted-ip"` bucket per path — so the
built-in 3-per-10s rule on `/sign-up` becomes **3 signups per 10 seconds for the
entire site**. It logs a warning once and otherwise fails quietly. Anyone enabling
this must set `advanced.ipAddress.ipAddressHeaders: ["fly-client-ip"]` first.

### Verdict

Switching buys two things we can each build in a few dozen lines in the action, and
costs three things that work today. Doing it ourselves is also strictly more capable —
per-email limits, per-route thresholds, shadow mode, and our own logging.

If `/join` were being written from scratch with no progressive-enhancement
requirement, client-side plus the captcha plugin would be a reasonable default. Given
what exists, the migration is not justified by abuse prevention. If we ever move
`/join` to the client for _other_ reasons, revisit: Phase 1 largely collapses into
config, and Phase 3 becomes trivial.

**Middle option, if we want the built-ins without giving up the form:** keep the
action, but forward to `auth.handler()` with a synthesized `Request` (copying the
client's headers so IP resolution and the origin check still work, and lifting the
captcha token from the form field into the `x-captcha-response` header). That yields
the full router middleware stack while keeping Conform and progressive enhancement.
The cost is an awkward internal-request indirection plus `Set-Cookie` propagation, and
it still does not solve the per-email limit — so it is worth it only if we specifically
want the captcha plugin rather than a direct provider call.

---

## 6. Sources

better-auth behaviour in §1 and §5 was verified against the installed `better-auth@1.6.25`
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
