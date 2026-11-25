#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p ../instances
secret=../instances/.platform-db-password
if [ ! -e "$secret" ]; then
    (umask 077; set -C; openssl rand -hex 32 > "$secret")
fi
portal_secret=../instances/.portal-password
if [ ! -e "$portal_secret" ]; then
    (umask 077; set -C; openssl rand -hex 32 > "$portal_secret")
fi
docker compose up -d --wait db
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U plataforma -d plataforma < 001_catalogo.sql
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U plataforma -d plataforma < 002_contas.sql
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U plataforma -d plataforma < 003_dashboard.sql
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U plataforma -d plataforma < 004_license_capacity.sql
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U plataforma -d plataforma < 005_license_plan.sql

python3 bootstrap_platform.py "$@"
docker compose up -d portal
