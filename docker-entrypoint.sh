#!/bin/sh
set -e

# Push database schema (idempotent — safe to run on every start)
echo "[entrypoint] Pushing database schema..."
node ./node_modules/.bin/drizzle-kit push --force 2>&1 || echo "[entrypoint] WARNING: schema push failed (may already be up to date)"

# Run the original command
exec "$@"
