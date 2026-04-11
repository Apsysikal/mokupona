#!/bin/sh -e

# Fly starts the container through this entrypoint. We intentionally run Prisma
# migrations on boot because this app stores SQLite on the mounted /data volume,
# and Fly release commands do not attach persistent volumes.

# allocate swap space
fallocate -l 512M /swapfile
chmod 0600 /swapfile
mkswap /swapfile
echo 10 > /proc/sys/vm/swappiness
swapon /swapfile
echo 1 > /proc/sys/vm/overcommit_memory

npx prisma migrate deploy
exec npm run start
