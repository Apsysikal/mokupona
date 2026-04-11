#!/bin/sh -e

# Fly starts the container through this entrypoint. We intentionally run Prisma
# migrations on boot because this app stores SQLite on the mounted /data volume,
# and Fly release commands do not attach persistent volumes.

npx prisma migrate deploy
exec npm run start
