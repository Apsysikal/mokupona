#!/bin/sh -e

# Fly starts the container through this entrypoint. We intentionally run Prisma
# migrations on boot because this app stores SQLite on the mounted /data volume,
# and Fly release commands do not attach persistent volumes.

npx prisma migrate deploy

# logrotate runs from /etc/cron.hourly; without the daemon nothing rotates and
# the 30 day retention window silently stops being enforced
cron

exec npm run start
