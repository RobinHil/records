#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations"
prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "[entrypoint] Seeding admin user (idempotent)"
node /app/prisma/seed.js

echo "[entrypoint] Starting Next.js"
exec node /app/server.js
