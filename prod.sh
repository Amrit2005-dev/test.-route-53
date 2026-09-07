#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Building and starting Route53 Clone (production mode)..."

cd "$ROOT"
docker compose down 2>/dev/null || true
docker compose up --build -d

echo ""
echo "Waiting for services..."
for i in {1..30}; do
  if curl -sf http://127.0.0.1:8000/api/health/ready >/dev/null && curl -sf http://127.0.0.1:3000/login >/dev/null; then
    echo "All services healthy."
    break
  fi
  sleep 2
done

echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://127.0.0.1:8000/api/health"
echo "Login:    admin / admin123"
echo ""
echo "Stop: docker compose down"
