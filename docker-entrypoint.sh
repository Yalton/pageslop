#!/bin/sh
set -e

# Only the service with RUN_MIGRATIONS=1 (app) migrates; others wait for it
# via depends_on so concurrent runs can't race. A failed migration stops the
# container instead of starting the app on a half-migrated schema.
if [ "${RUN_MIGRATIONS:-}" = "1" ]; then
  echo "[entrypoint] Applying database migrations..."
  node ./scripts/migrate.mjs
fi

# Run the original command
exec "$@"
