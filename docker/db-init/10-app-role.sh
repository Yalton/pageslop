#!/bin/sh
# Runs once, when the postgres image initialises an empty data directory.
# Creates the non-superuser role the app and worker connect as, and makes it
# the database owner so drizzle-kit push and pg-boss can create their objects.
set -eu
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v app_pw="$PAGESLOP_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE pageslop_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_pw';
ALTER DATABASE :"db" OWNER TO pageslop_app;
SQL
