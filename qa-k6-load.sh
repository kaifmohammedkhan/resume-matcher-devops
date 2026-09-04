#!/usr/bin/env bash
set -uo pipefail

start_postgres() {
  local name="$1" db="$2";
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$db" -p 5432:5432 postgres:15 >/dev/null
  for i in {1..30}; do docker exec "$name" pg_isready -U postgres -d "$db" >/dev/null 2>&1 && return 0; sleep 2; done
  docker logs "$name" || true; return 1
}
stop_container() { docker rm -f "$1" >/dev/null 2>&1 || true; }
prepare_wiremock() { mkdir -p wiremock-mappings; cp -r wiremock/mappings/* wiremock-mappings/; docker rm -f wiremock 2>/dev/null || true; docker run -d --name wiremock -p 8080:8080 -v "$PWD/wiremock-mappings:/home/wiremock/mappings:ro" wiremock/wiremock:2.35.0 >/dev/null; sleep 3; }

echo '===== QA: K6 LOAD ====='
start_postgres qa-postgres-load resume_db || exit 1
trap 'stop_container qa-postgres-load; docker rm -f wiremock >/dev/null 2>&1 || true' EXIT

prepare_wiremock || exit 1
npm ci --ignore-scripts=false || exit 1; if npm run | grep -q 'build'; then npm run build; fi
command -v k6 >/dev/null 2>&1 || { echo 'ERROR: k6 is not installed.'; exit 1; }
mkdir -p results

PORT=3000 WIREMOCK_URL=http://127.0.0.1:8080 RATE_LIMIT_MAX=10000 npm start > results/app.log 2>&1 & APP_PID=$!; echo "$APP_PID" > results/app.pid
for i in {1..30}; do curl --silent --fail http://127.0.0.1:3000/ >/dev/null 2>&1 && break; kill -0 "$APP_PID" 2>/dev/null || { cat results/app.log; exit 1; }; sleep 2; done

HTTP_STATUS=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/ || true); [[ "$HTTP_STATUS" != 000 ]] || exit 1

set +e; k6 run --vus 10 --duration 30s --out json=results/output.json --summary-export=results/summary.json tests/load.js 2>&1 | tee results/k6-console.log; rc=${PIPESTATUS[0]}; set -e
echo "$rc" > results/k6-exit-code.txt
mkdir -p reports/k6-load; cp -a results/. reports/k6-load/ 2>/dev/null || true
{ echo 'k6 Load Diagnostics'; date -u '+%Y-%m-%dT%H:%M:%SZ'; cat results/app.log 2>/dev/null || true; cat results/k6-console.log 2>/dev/null || true; cat results/summary.json 2>/dev/null || true; } > results/diagnostics.log
kill "$APP_PID" 2>/dev/null || true
exit "$rc"