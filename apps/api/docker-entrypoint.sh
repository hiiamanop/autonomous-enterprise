#!/bin/sh
# ------------------------------------------------------------------------------
# API container entrypoint.
#
# Applies pending Prisma migrations before starting the server, so a fresh
# database is usable without a manual step and a schema change cannot silently
# leave the running code ahead of the database.
#
# Only runs when DATABASE_DRIVER=prisma; the in-memory driver needs no database
# and must stay runnable with no PostgreSQL at all.
# ------------------------------------------------------------------------------
set -eu

if [ "${DATABASE_DRIVER:-}" = "prisma" ]; then
  echo "[entrypoint] DATABASE_DRIVER=prisma — applying migrations"

  # PostgreSQL may still be accepting connections before it is ready to serve
  # them, so migration is retried rather than failing the container outright.
  attempt=1
  max_attempts=10
  # Invoked directly rather than via `node`: the file in .bin is a shell
  # wrapper, not a JavaScript entry point.
  until /repo/node_modules/.bin/prisma migrate deploy --schema=/repo/prisma/schema.prisma; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "[entrypoint] migrations failed after ${max_attempts} attempts" >&2
      exit 1
    fi
    echo "[entrypoint] migration attempt ${attempt} failed; retrying in 3s"
    attempt=$((attempt + 1))
    sleep 3
  done

  echo "[entrypoint] migrations applied"
else
  echo "[entrypoint] DATABASE_DRIVER=${DATABASE_DRIVER:-in-memory} — skipping migrations"
fi

exec "$@"
