#!/bin/sh -e

# Fly starts the container through this entrypoint. We intentionally run Prisma
# migrations on boot because this app stores SQLite on the mounted /data volume,
# and Fly release commands do not attach persistent volumes.

# The binaries are invoked through `node` rather than `npx`/`npm run` because
# each wrapper is a full extra Node process. It costs ~21 MB during the
# migration, and — worse — the one wrapping the server would never exit: `npm
# run start` leaves an idle npm process resident for the life of the container,
# ~18 MB of a 256 MB machine to supervise a process Fly is already supervising.
# It also puts two hops (npm, then sh) between Fly's SIGINT and the server's own
# shutdown handler, which is what flushes the log sink.
# Measurements in docs/memory-profile/findings.md.

node ./node_modules/.bin/prisma migrate deploy

# logrotate runs from /etc/cron.hourly; without the daemon nothing rotates and
# the 30 day retention window silently stops being enforced
cron

exec node ./node_modules/.bin/react-router-serve ./build/server/index.js
