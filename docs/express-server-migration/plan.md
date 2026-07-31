# Custom Express server: `react-router-serve` → `server.js`

Status: **investigation, nothing implemented.** This document is the answer to
[`docs/logging-rework/plan.md`](../logging-rework/plan.md) open question 2
("Custom Express server? Would remove morgan duplication and give an ordered
shutdown hook. Deferred — revisit if the flush proves flaky in phase 6.") and it
also resolves open question 1 (whether `SIGINT` reaches node through npm) as a
side effect, because the swap is a natural moment to stop running npm as PID 1.

Shape follows the official
[`node-custom-server`](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server)
template. Every deviation from it is listed under
[Where we deviate from the template](#where-we-deviate-from-the-template) with
the reason.

## Goal

Own the HTTP layer, so that:

1. **Request logging is ours alone.** `@react-router/serve` hardcodes
   `morgan("tiny")` with no way to disable it. Today every request produces both
   a structured pino `Request completed` record (from the `instrumentations`
   export in [`app/entry.server.tsx`](../../app/entry.server.tsx)) and an
   unstructured morgan line on stdout. The logging contract accepted that
   duplication; this removes it.
2. **Boot and shutdown are ordered.** `@react-router/serve` prints its own
   `[react-router-serve] http://localhost:…` line through `console.log`, outside
   the logger, and registers `SIGTERM`/`SIGINT` handlers that call
   `server.close()` and nothing else — with no ordering guarantee against ours.
3. **We can put middleware in front of the router** without waiting for a
   feature in `@react-router/serve` (rate limiting, a `/metrics` endpoint,
   trusted-proxy handling, per-route cache headers).

Non-goal: changing anything a browser can observe. Beyond dropping morgan and
one cache-header change (below), phase 1 is a like-for-like swap.

## What `@react-router/serve` does today

Reconstructed from `packages/react-router-serve/cli.ts` at v8. This is the
parity target — everything here has to exist somewhere after the swap or be a
deliberate, recorded decision to drop it.

| Behaviour                                                                              | Kept?                                        |
| -------------------------------------------------------------------------------------- | -------------------------------------------- |
| `process.env.NODE_ENV = process.env.NODE_ENV ?? "production"` **before loading the build** | yes — see [Gotchas](#gotchas)                |
| `sourceMapSupport.install()` against `<build>.map`                                     | replaced by `--enable-source-maps`           |
| `app.disable("x-powered-by")`                                                          | yes                                          |
| `compression()`                                                                        | yes                                          |
| `express.static("build/client/assets", { immutable: true, maxAge: "1y" })` at `/assets` | yes                                          |
| `express.static("build/client")` — **no `maxAge`**, i.e. `max-age=0`                    | changed to `maxAge: "1h"`                    |
| `express.static("public", { maxAge: "1h" })`                                           | dropped — see below                          |
| `morgan("tiny")`                                                                       | **dropped on purpose**                       |
| `createRequestHandler({ build, mode })` mounted at `app.all("/{*splat}")`               | yes, as `app.use(...)`                       |
| port from `PORT`, else first free port from 3000; host from `HOST`                     | `PORT`, else 3000; no free-port scan         |
| `["SIGTERM","SIGINT"].forEach(s => process.once(s, () => server?.close(console.error)))` | **dropped on purpose** — see [Shutdown](#shutdown) |

Two of those are worth spelling out.

**`express.static("public")` is dead weight in production.** The Dockerfile
never copies `public/` into the runtime image, so that mount resolves to a
directory that does not exist. It matches nothing. `react-router build` already
copies `public/*` into `build/client`, so the assets are served by the mount
above it — with no `maxAge`, i.e. `Cache-Control: public, max-age=0`. Giving
`build/client` a one-hour `maxAge` (what the template does) is therefore a small
caching improvement for the favicon, OG images and `robots.txt`, and the only
externally visible change in this phase. Fingerprinted `/assets/*` files keep
their immutable one-year policy either way.

**The free-port scan is not wanted.** In production `PORT` is always set
(`fly.toml` `[env] PORT = "8080"`, e2e sets `8811`, cypress reads the same
variable). Silently listening on a different port than asked for would make a
misconfiguration look like a healthy boot.

## Target layout

Two files, matching the template's split:

- **`server.js`** (repo root, plain ESM JavaScript) — the outer shell. Express
  instance, compression, the dev-vs-production branch, static assets, `listen`.
  It is JavaScript, not TypeScript, because it is the process entry point and
  must run without a build step; the template does the same.
- **`server/app.ts`** — the inner app: the React Router request handler, and
  nothing else. It is bundled by Vite as the SSR entry, so it may use the `~/*`
  alias and import anything from `app/`.

`build/server/index.js` stops being a React Router `ServerBuild` and becomes the
bundle of `server/app.ts`, exporting `app`. That is what the
`environments.ssr.build.rollupOptions.input` change in `vite.config.ts` does.

### `server/app.ts`

```ts
import { createRequestHandler } from "@react-router/express";
import express from "express";

import { logger } from "~/logger.server";

export const app = express();

// Re-exported so server.js can write its boot line through the same logger
// without importing app/ directly (it is outside the Vite graph, and has no
// `~/*` alias).
export { logger };

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    mode: process.env.NODE_ENV,
  }),
);
```

No `getLoadContext`. The template uses it to demo passing a value from Express
into a route context, but this app builds its contexts in root middleware
([`requestLoggerMiddleware`](../../app/features/auth/middleware.server.ts) mints
the request id and the child logger; `resolveOptionalUserMiddleware` installs the
lazy user resolver), and v8 hands the router a `RouterContextProvider` by
default. Adding `getLoadContext` would mean constructing that provider ourselves
for no gain. If we ever do need it, it **must** return a `RouterContextProvider`
instance, not a plain object.

### `server.js`

```js
import compression from "compression";
import express from "express";

// `react-router-serve` set this before it loaded anything, and modules branch on
// it at import time — app/logger.server.ts picks its sinks, its level and
// whether to register signal handlers here. Static imports above are hoisted,
// but the build is loaded through a dynamic import below, so this still lands
// before anything that reads it.
process.env.NODE_ENV ??= "production";

const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const app = express();

app.disable("x-powered-by");
app.use(compression());

let logger;

if (DEVELOPMENT) {
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({ server: { middlewareMode: true } }),
  );

  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (error instanceof Error) viteDevServer.ssrFixStacktrace(error);
      next(error);
    }
  });

  // Only the logger, not the whole app graph — the request path above loads
  // server/app.ts lazily so HMR keeps working.
  ({ logger } = await viteDevServer.ssrLoadModule("./app/logger.server.ts"));
} else {
  // `react-router build` copies public/ into build/client, so this one tree is
  // every static file the app has. Fingerprinted assets are immutable; the rest
  // — favicon, OG images, robots.txt — get an hour.
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  app.use(express.static("build/client", { maxAge: "1h" }));

  const build = await import(BUILD_PATH);
  app.use(build.app);
  ({ logger } = build);
}

// Express 5 forwards a rejected handler here. Without this, Express writes the
// stack to stderr itself and the record never reaches the file sink. Anything
// the router itself throws is already handled by `handleError` in
// app/entry.server.tsx; this only catches what happens outside it.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  logger.error({ error, path: req.path }, "Unhandled error in the HTTP server");
  res.status(500).send("Internal Server Error");
});

app.listen(PORT, () => {
  logger.info({ port: PORT, mode: process.env.NODE_ENV }, "server listening");
});
```

### Everything else that changes

| File                    | Change                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`        | add `environments.ssr.build.rollupOptions.input = "./server/app.ts"`; drop `server: { port: 3000 }` (Vite never listens in middleware mode — the port is `server.js`'s)                        |
| `package.json` scripts  | `dev` → `node ./mocks/index.js & cross-env NODE_ENV=development node --conditions development server.js`; `start` → `node --enable-source-maps server.js`; `start:mocks` likewise             |
| `package.json` deps     | add `express@^5`, `compression@^1.8`, `@react-router/express@^8.3.0` (must track `react-router`); remove `@react-router/serve`; dev-add `@types/express@^5`, `@types/compression@^1.8`         |
| `Dockerfile`            | one line: `COPY --from=build /myapp/server.js /myapp/server.js`. `server/app.ts` needs no copy — it is bundled into `build/server`                                                            |
| `start.sh`              | `exec npm run start` → `exec node --enable-source-maps server.js`, so node is PID 1 and Fly's `SIGINT` reaches it directly                                                                    |
| `tsconfig.json`         | nothing, most likely — `server/app.ts` is already matched by `include: ["**/*.ts", …]` and the `~/*` path is already mapped. See [Gotchas](#gotchas) for the one thing to check               |
| `eslint.config.js`      | nothing — `server.js` and `server/app.ts` are covered by the existing globs, and neither imports `~/db.server`                                                                                |
| `react-router.config.ts` | nothing                                                                                                                                                                                     |

The `--conditions development` flag on `dev` is not decoration: React Router
ships dev-only code behind a `development` export condition, and without it the
dev server resolves the production build of the router.

## Where we deviate from the template

| Template                                                | Here                                                                         | Why                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `morgan("tiny")` in production                           | no morgan                                                                    | the whole point — `instrumentations` in `app/entry.server.tsx` already emits a structured `Request completed` record per request             |
| `console.log("Starting …")`, `console.log("Server is running on …")` | `logger.info` through the app's pino instance                    | the logging contract reserves the bare `logger` for exactly this: boot and shutdown lines                                                    |
| no error-handling middleware                             | one, logging through pino                                                    | Express's default handler writes to stderr, which never reaches the `/data/logs` file sink                                                   |
| three-file `tsconfig` project-reference split            | keep the single `tsconfig.json`                                              | the split exists so the template can give `server.js` node types and `app/` DOM types; this repo's one config already carries both           |
| `getLoadContext` demo                                    | omitted                                                                      | contexts are built in root middleware; see above                                                                                             |
| `express.static("build/client", { maxAge: "1h" })`       | same                                                                         | (agreeing with the template *against* `react-router-serve`'s `max-age=0` — the only user-visible change)                                     |
| no signal handling                                       | none in `server.js` either                                                   | `app/logger.server.ts` owns the only handlers, per the logging contract. See [Shutdown](#shutdown)                                            |
| `npm ci` / alpine Dockerfile                             | keep ours                                                                    | ours does Prisma generate, logrotate, cron, the SQLite CLI shortcut and a `/data` volume — the template's is a toy                            |

## Shutdown

The logging contract states plainly: *"`app/logger.server.ts` owns the only
`SIGTERM`/`SIGINT` handlers the app registers, outside tests."* Phase 1 keeps
that true by registering **no** handler in `server.js`.

That is honest parity, not a compromise. Today `react-router-serve` does register
`server.close()` on both signals, but the pino handler runs `process.exit(0)`
as soon as the flush succeeds, so in practice the close never completes and
in-flight connections are cut either way. Dropping the close changes nothing
observable, and it avoids two handlers racing for the same process.

The ordered drain is the *reason* to want a custom server, but it is a change to
the logging contract and belongs in its own change:

```
SIGINT → stop accepting connections → let in-flight requests finish (bounded)
       → flush both sinks → exit 0
```

Node runs signal listeners in registration order, and the logger's listener is
registered when the build is imported — before `server.js` could register its
own. So it cannot be bolted on from the outside. The shape that works is a small
inversion inside `app/logger.server.ts`: keep it the sole owner of the handlers,
but let a caller register a pre-flush task.

```ts
// app/logger.server.ts — sketch, phase 2
const beforeFlush: Array<() => Promise<void>> = [];
export function onBeforeLogFlush(task: () => Promise<void>) {
  beforeFlush.push(task);
}
```

`server.js` would then register `() => new Promise(r => server.close(r))`,
bounded well inside `fly.toml`'s 5 s `kill_timeout` (the existing 250 ms drain
grace is the budget to reason against). Deliberately **out of scope for the
swap** — it makes the handler async, which the contract currently guarantees it
is not, and that deserves review on its own.

## Gotchas

Each of these is a way to ship a swap that looks fine and is not.

1. **`NODE_ENV` must default to `production` before the build is imported.**
   `react-router-serve` does this on line 1. Without it, `npm run test:e2e:run`
   — which calls `start:mocks` with no `NODE_ENV` — would boot the logger into
   `pino-pretty` at `debug` level and hand `createRequestHandler` an undefined
   mode. Docker sets `NODE_ENV=production` explicitly, so this only bites
   locally and in CI, which is exactly where it would go unnoticed.
2. **Never add a body parser.** No `express.json()`, no `express.urlencoded()`,
   no `multer`. `@react-router/express` converts the raw `req` stream into a
   Fetch `Request`; a parser upstream consumes the stream first and every form
   POST and every image upload
   ([`app/features/images/image-upload.server.ts`](../../app/features/images/image-upload.server.ts))
   sees an empty body.
3. **Middleware order is load-bearing.** Static assets must be mounted before
   the request handler, or `/assets/*` goes through the router and gets a 404
   from the route table. This is also what keeps asset requests out of the pino
   request log, which the logging plan relies on ("Static assets need no
   exclusion — `@react-router/serve` mounts them before the route table").
4. **`virtual:react-router/server-build` typing.** The template's `tsconfig`
   resolves it with `types: ["vite/client"]` plus the generated
   `.react-router/types`, which this repo already has. If `npm run typecheck`
   still cannot resolve the specifier, the fix is a one-line ambient
   declaration, not a tsconfig restructure. **Verify during implementation** —
   this is the one claim here I could not test (see
   [Verification](#verification)).
5. **Source maps.** `react-router-serve` installs `source-map-support` so stack
   traces from `build/server/index.js` point at real files. Replace it with
   `node --enable-source-maps`; if `build/server/index.js.map` turns out not to
   be emitted, error records get bundle offsets and we should turn server
   sourcemaps on in the Vite config.
6. **`--host` disappears and is not missed.** `react-router dev --host` exposed
   the dev server on the LAN. `app.listen(PORT)` binds all interfaces already,
   and Vite's HMR websocket rides the same Express server in middleware mode, so
   LAN access keeps working without a flag.
7. **`mocks/index.js` is already inert and stays that way.** `node
   ./mocks/index.js &` starts MSW in a *separate process* from the app, so it
   intercepts nothing the app does. A custom server finally makes the fix
   available (`node --import ./mocks/index.js server.js`, same process), but
   turning it on would newly intercept the healthcheck's self-`fetch`, Resend
   and Cloudinary. Left alone here; noted as a follow-up.
8. **`trust proxy` is not needed.** `getClientIPAddress`
   ([`app/shared/http.server.ts`](../../app/shared/http.server.ts)) reads
   `Fly-Client-IP` off the Fetch `Request`, not `req.ip`, so nothing depends on
   Express's proxy handling. If that ever changes, `app.set("trust proxy", 1)`
   has to come with a story about who is allowed to set the header.
9. **`compression()` and SSR streaming.** Unchanged from today — the same
   middleware sits in the same place in `react-router-serve`. Worth a conscious
   look at the streaming behaviour during verification anyway, because
   `app/entry.server.tsx` has a `streamTimeout` of 5 s and a render deadline
   that assumes the shell reaches the client promptly.

## Phases

### Phase 1 — the swap

- [ ] `server/app.ts`, `server.js` as above.
- [ ] `vite.config.ts`: SSR input, drop the dead `server.port`.
- [ ] `package.json`: dependencies and the three scripts.
- [ ] `Dockerfile`: copy `server.js`.
- [ ] `start.sh`: `exec node --enable-source-maps server.js` (node becomes PID
      1; this is the fix for logging open question 1).
- [ ] `README.md`: the "Tech stack" list gains the custom server; the local-setup
      steps are unchanged.

`docs/logging-rework/plan.md` is where the morgan duplication was accepted, but
that document is explicitly historical ("the plan as written; where it differs
from the code, the code and `contract.md` win") and should not be edited.
`contract.md` never mentioned morgan, so there is nothing to strike there
either — this document is the record that the duplication is gone.

### Phase 2 — follow-ups, each on its own

- [ ] Ordered shutdown drain (`onBeforeLogFlush`), amending the logging
      contract's shutdown section.
- [ ] In-process MSW in dev (`--import ./mocks/index.js`), with a decision about
      what it is now allowed to intercept.
- [ ] Anything the swap was for: rate limiting, cache headers per route,
      `/metrics`.

## Verification

**This plan is unverified against a running build.** It was written in an
environment where `npm ci` cannot reach the registry and node is v22 against the
repo's `>=24.13.0`, so nothing below has been executed. Treat the code blocks as
reviewed-by-reading, not as tested.

Ordered so that the cheap checks fail first:

1. `npm run typecheck` — catches gotcha 4.
2. `npm run lint`, `npm run build`.
3. `npm run dev` — page renders, HMR on a component edit, HMR on a route
   loader edit, `.react-router/types` still regenerate on a route rename.
4. `npm run test:e2e:run` — this is the real gate. It runs `start:mocks` on port
   8811 and drives login, dinner signup and the admin flows through Cypress,
   which covers `@react-router/express` end to end: form POSTs, redirects,
   sessions, the `/api/auth/*` splat route, and file upload.
5. `curl -sI localhost:8811/assets/<fingerprinted>.js` → `max-age=31536000,
   immutable`; `curl -sI localhost:8811/favicon.ico` → `max-age=3600`.
6. `curl localhost:8811/healthcheck` → `OK` (it does a self-`HEAD` to `/`, so it
   exercises the server twice).
7. Confirm stdout carries exactly one structured line per request and no morgan
   line, and that `$LOG_DIR/app.log` carries the same.
8. `Ctrl-C` the dev server and `kill -INT` the production one: one `shutting
   down` record, exit 0, no lost tail.
9. On staging, after deploy: `fly ssh console -C "ps -o pid,comm -p 1"` shows
   `node`, not `npm` — the PID 1 fix from logging open question 1.

## Open questions

1. **Do we want the ordered drain at all?** It is the strongest argument for
   this migration, and it is deferred to phase 2 here. If the answer is no, the
   remaining wins are morgan removal and future headroom — real, but smaller.
2. **`build/client` at `max-age=1h`** — agreeing with the template over
   `react-router-serve`'s effective `max-age=0`. Cheap to keep at 0 if a
   stale favicon or OG image for an hour is unwanted.
3. **Express 5 or Hono?** The template is Express and this repo has no Express
   history to preserve either way. Express is the lower-risk choice
   (`@react-router/express` is first-party and is what `react-router-serve`
   itself uses, so phase 1 really is a like-for-like swap). Recorded only
   because the community templates make Hono look like a live option; it is not
   one for a like-for-like swap.
