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
   DATABASE_URL="file:./dev.db"
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

This project includes Fly configuration in `fly.toml` and container build steps in `Dockerfile`.

Runtime details:

- App listens on port `8080`
- SQLite database is stored at `/data/sqlite.db`
- `start.sh` runs `prisma migrate deploy` before starting the app
- Health endpoint: `/healthcheck`

Before deploying, ensure:

1. Fly app exists and `fly.toml` app name is correct.
2. Persistent volume is mounted at `/data`.
3. `SESSION_SECRET` is set as a Fly secret.
4. `DATABASE_URL` is set to `file:/data/sqlite.db`.

Useful commands:

```sh
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app <fly-app-name>
fly volumes create data --size 1 --app <fly-app-name>
fly ssh console -C database-cli --app <fly-app-name>
```

## Testing

- Unit/integration tests: `npm run test`
- E2E interactive: `npm run test:e2e:dev`
- E2E CI/headless: `npm run test:e2e:run`

For full local verification, run:

```sh
npm run validate
```
