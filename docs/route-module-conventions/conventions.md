# Route Module Conventions

House rules for every route module in `app/routes/` (and `app/root.tsx`), aligned with the [React Router v8 Route Module docs](https://reactrouter.com/start/framework/route-module). Companion to [`action-plan.md`](./action-plan.md), which tracks bringing existing files up to these rules.

## Types: always the generated ones

Every route module imports its generated types and nothing type-related from `react-router`:

```tsx
import type { Route } from "./+types/<route-name>";

export async function loader({ request, params }: Route.LoaderArgs) { … }

export async function action({ request, params }: Route.ActionArgs) { … }

export const meta: Route.MetaFunction = ({ loaderData, matches }) => [
  { title: "Page Title" },
];

export default function Page({ loaderData, actionData }: Route.ComponentProps) { … }
```

- Never `LoaderFunctionArgs`, `ActionFunctionArgs`, `MetaFunction`, or `MetaFunction<typeof loader>` from `react-router` — the generated `Route.*` types carry the loader's return type automatically and track upstream breaking changes (v8 renamed `MetaArgs.data` to `loaderData`; the generated types absorbed that, hand-written generics did not).
- Cross-route data (e.g. root loader data on the index page) comes from typed `matches` in `Route.MetaArgs` / `Route.ComponentProps`, not from importing types out of other route files.

## Components: props, not hooks

Route components receive `loaderData`, `actionData`, and `params` via `Route.ComponentProps`. Do not use `useLoaderData`, `useActionData`, or `useParams` inside route modules.

- `useUser()` / `useOptionalUser()` are for shared components that can't receive props. A route component that needs the user loads it in its own loader.
- Purely static routes take no props at all.

## Export order

Within a file, in this order (per the docs' conventional ordering):

1. imports (generated `./+types` import in its own group after external packages)
2. `loader`
3. `action`
4. `meta`
5. default component
6. `ErrorBoundary`

Resource routes (no UI — e.g. `logout.tsx`, `healthcheck.tsx`, `file.$fileId.tsx`, CSV exports, `*.delete.tsx`) export only `loader`/`action` and no `meta`.

## Meta

- Every UI route exports `meta` with at least a `title`.
- Shape: `export const meta: Route.MetaFunction = () => [{ title: "…" }];` — arrow-function const, not a function declaration.

## Status codes and responses

- Not found: `throw new Response("Not found", { status: 404 })`
- Forbidden: `throw new Response("Forbidden", { status: 403 })` — same as [`session.server.ts`](../../app/utils/session.server.ts)'s `requireUserWithRole`; never 400 for authorization failures.
- Post-mutation and guard redirects: `redirect()` (or `redirectWithToast` from [`toast.server.ts`](../../app/utils/toast.server.ts)).
- Loaders/actions return raw objects, not `data()`/`json()`, unless setting headers or status (then `data()`).

## Auth

- Centralized helpers from [`session.server.ts`](../../app/utils/session.server.ts): `requireUserWithRole(request, roles)` for gated routes, `requireUserId`/`requireUser` for signed-in-only, `getUserId`/`getUser` for optional.
- Mutation routes check in **both** loader and action — a layout-level check does not protect child actions.
- Admin sections: `["moderator", "admin"]` for content, `["admin"]` for user management.

## Form actions (conform + zod)

- `parseWithZod(formData, { schema })`, guard with `if (submission.status !== "success" || !submission.value) return submission.reply();`.
- `actionData` for a form route has exactly one shape: the conform submission result. Side-channel failures (e.g. image upload) are folded into it via `submission.reply({ formErrors: […] })`, never returned as ad-hoc objects.

## Multiple intents

Mutations are split into separate routes (e.g. `*.delete.tsx` with a redirecting loader and a mutating action) rather than dispatched by an `intent` field within one action. Keep it that way.

## Open question: v8 middleware

v8 enables route [middleware](https://reactrouter.com/how-to/middleware) by default. The `requireUserWithRole` call repeated across every admin loader/action could become a single `middleware` export on `admin.tsx` with a `userContext` from `createContext()`, letting child loaders read `context.get(userContext)`. This is a structural change, deliberately **out of scope** for the harmonization pass — decide separately.
