#!/bin/sh
set -e

# Only the service with RUN_MIGRATIONS=1 (app) pushes the schema; others wait
# for it via depends_on so concurrent pushes can't race.
if [ "${RUN_MIGRATIONS:-}" = "1" ]; then
  # Push database schema (idempotent — safe to run on every start)
  echo "[entrypoint] Pushing database schema..."
  node ./node_modules/.bin/drizzle-kit push --force 2>&1 || echo "[entrypoint] WARNING: schema push failed (may already be up to date)"
fi

# Run the original command
exec "$@"
