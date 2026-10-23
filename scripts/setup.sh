#!/bin/sh
# Generates .env and .env.db for Docker Compose with fresh random secrets.
# Usage: ./scripts/setup.sh [PUBLIC_URL]   (default http://localhost:3847)
# Existing files are never overwritten.
set -eu
cd "$(dirname "$0")/.."

url="${1:-http://localhost:3847}"
url="${url%/}"

for f in .env .env.db; do
  if [ -e "$f" ]; then
    echo "$f already exists; remove it first to regenerate." >&2
    exit 1
  fi
done
command -v openssl >/dev/null || { echo "openssl is required." >&2; exit 1; }

db_pw=$(openssl rand -hex 32)
umask 077

sed -e "s|pageslop_app:change-me@|pageslop_app:${db_pw}@|g" \
    -e "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${url}|" \
    -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" \
    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 32)|" \
    .env.example > .env

sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 32)|" \
    -e "s|^PAGESLOP_DB_PASSWORD=.*|PAGESLOP_DB_PASSWORD=${db_pw}|" \
    .env.db.example > .env.db

echo "Wrote .env and .env.db (mode 600) for ${url}."
echo "Optional: set SMTP_* in .env to send email; without it, verification links go to 'docker compose logs app'."
echo "Next: docker compose up -d --build"
