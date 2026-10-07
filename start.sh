#!/bin/sh -e

node ./node_modules/.bin/prisma migrate deploy

cron

exec node ./node_modules/.bin/react-router-serve ./build/server/index.js
