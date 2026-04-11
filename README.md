# moku pona

Web app for the moku pona dinner society in Zurich.

The app includes:

- Public landing page and dinner pages
- Dinner signup (RSVP) flow
- Role-based authentication (user, moderator, admin)
- Admin area for dinners, locations, users, and board members
- CSV export for dinner signups
- SQLite + Prisma data layer

## Tech stack

- React Router v7 (framework mode)
- React 19 + TypeScript
- Tailwind CSS v4
- Prisma ORM with SQLite (`@prisma/adapter-better-sqlite3`)
- Vitest + Testing Library
- Cypress for end-to-end tests
- Fly.io deployment via Docker

## Requirements

- Node.js 24+
- npm

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create your env file (`.env`) with at least:

   ```env
   DATABASE_URL="file:./prisma/data.db"
   SESSION_SECRET="replace-with-a-random-secret"
   ```

3. Initialize database and seed data:

   ```sh
   npm run setup
   ```

4. Start development server:

   ```sh
   npm run dev
   ```

By default, the app runs at `http://localhost:3000`.

## Seeded accounts

`npm run setup` seeds users with password `mokupona`:

- `user@mokupona.ch` (role: user)
- `moderator@mokupona.ch` (role: moderator)
- `admin@mokupona.ch` (role: admin)

## Environment variables

Required:

- `DATABASE_URL`: Prisma SQLite connection string
- `SESSION_SECRET`: secret used for session and toast cookies

Optional:

- `IMAGE_UPLOAD_FOLDER`: file storage directory for uploaded dinner images
  - Defaults to a temporary directory in development
  - Set to a persistent path in production (for Fly this is `/data/uploads/images`)
- `ALLOW_INDEXING`: set to `false` to disable search engine indexing tags
- `PORT`: server port (Fly uses `8080`)

## Useful scripts

- `npm run dev`: start dev server (with MSW mock server)
- `npm run build`: build production assets
- `npm run start`: serve production build
- `npm run setup`: generate Prisma client, apply migrations, seed database
- `npm run prisma:studio`: open Prisma Studio
- `npm run optimize:images`: run image optimization helper
- `npm run test`: run unit tests
- `npm run test:e2e:dev`: open Cypress against dev server
- `npm run test:e2e:ci`: run the CI-oriented Cypress command against a prebuilt app
- `npm run test:e2e:run`: run Cypress in headless mode
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks
- `npm run validate`: run test + lint + typecheck + e2e

## Project structure

- `app/routes`: route modules (public pages + admin area)
- `app/models`: server-side data access helpers
- `app/components`: reusable UI and feature components
- `prisma/schema.prisma`: database schema
- `prisma/seed.ts`: seed data
- `cypress/e2e`: end-to-end tests

## Deployment (Fly.io)

This project uses:

- `fly.toml` for Fly runtime configuration
- `Dockerfile` for the production image build
- `start.sh` for boot-time Prisma migrations and server startup
- `.github/workflows/ci.yml` for CI

Runtime details:

- App listens on port `8080`
- SQLite database is stored at `/data/sqlite.db`
- Uploaded images are stored under `/data/uploads/images`
- `start.sh` runs `prisma migrate deploy` before starting the app
- The migration step happens on boot intentionally because the app depends on the mounted `/data` volume
- Health endpoint: `/healthcheck`

### Current migration status

Phases 1 and 2 are implemented in-repo:

- Pull requests run CI only.
- Pushes to `dev` that pass CI trigger a `staging` deployment in the same workflow run.
- Pushes to `main` that pass CI trigger a `production` deployment job in the same workflow run, which should pause for environment approval.

### Environment configuration

1. Create GitHub Environments named `staging` and `production`.
2. Add `FLY_APP_NAME` as an environment variable to both environments.
3. Add `FLY_API_TOKEN` as an environment secret to both environments.
4. Configure required reviewers on the `production` environment.
5. Confirm both Fly apps exist and have a persistent volume mounted at `/data`.
6. Set `SESSION_SECRET` as a Fly secret for both apps.

`DATABASE_URL`, `IMAGE_UPLOAD_FOLDER`, and `PORT` are set in `fly.toml` and do not need to be duplicated as Fly secrets.

### Gate 2: required external validation

Before relying on the new deploy flow, validate these settings outside the repo:

1. Confirm GitHub Actions policy allows the workflow to run the selected actions and shell steps.
2. Confirm the `production` environment reviewer gate behaves as intended.
3. Confirm both `FLY_API_TOKEN` secrets have the intended scope.
4. Confirm branch policy matches the promotion flow: `dev` to staging, `main` to production.

### Useful Fly commands

```sh
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app <fly-app-name>
fly volumes create data --size 1 --app <fly-app-name>
fly ssh console -C database-cli --app <fly-app-name>
```

## Testing

- Unit/integration tests: `npm run test`
- E2E interactive: `npm run test:e2e:dev`
- E2E CI/headless: `npm run test:e2e:ci`
- E2E local headless: `npm run test:e2e:run`

For full local verification, run:

```sh
npm run validate
```
