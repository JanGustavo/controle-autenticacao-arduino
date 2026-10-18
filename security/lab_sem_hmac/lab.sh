#!/usr/bin/env bash
set -euo pipefail
lab_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$lab_dir"
# Projeto, compose e env explícitos: não herdar .env/compose de produção.
compose=(docker compose --project-name ardlock-lab-security --env-file "$lab_dir/.env.lab" -f "$lab_dir/compose.yaml")
case "${1:-}" in
  up)
    python3 "$lab_dir/prepare_lab.py"
    image_id=$(docker inspect --format '{{.Image}}' controle-acesso-backend)
    docker image tag "$image_id" ardlock-lab-api:local
    "${compose[@]}" up -d --wait --wait-timeout 180
    ;;
  ps|logs|down)
    "${compose[@]}" "$1"
    ;;
  *)
    echo 'Uso: LAB_BIND_IP=192.168.0.20 bash lab.sh up'
    echo 'Sem LAB_BIND_IP, publica somente em 127.0.0.1:8002.'
    echo 'Também disponíveis: ps, logs, down (preserva o banco do laboratório).'
    exit 2
    ;;
esac
