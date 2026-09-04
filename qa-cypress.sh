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

echo '===== QA: CYPRESS E2E ====='
start_postgres qa-postgres-cypress resumes || exit 1
trap 'stop_container qa-postgres-cypress' EXIT

npm ci --ignore-scripts=false || exit 1
if npm run | grep -q 'build'; then npm run build; fi
[[ -d cypress/e2e ]] || { echo 'ERROR: cypress/e2e not found.'; exit 1; }
mkdir -p cypress/reports

PORT=3000 npm start > cypress/reports/app.log 2>&1 & APP_PID=$!; echo "$APP_PID" > cypress/reports/app.pid
for i in {1..30}; do curl --silent --fail http://127.0.0.1:3000/ >/dev/null 2>&1 && break; kill -0 "$APP_PID" 2>/dev/null || { cat cypress/reports/app.log; exit 1; }; sleep 2; done

set +e
CYPRESS_baseUrl=http://127.0.0.1:3000 ./node_modules/.bin/cypress run --browser chrome --headless --reporter junit --reporter-options 'mochaFile=cypress/reports/junit-[hash].xml,toConsole=true' 2>&1 | tee cypress/reports/cypress-run.log
rc=${PIPESTATUS[0]}; set -e

echo "$rc" > cypress/reports/cypress-exit-code.txt
{ echo 'Cypress Diagnostics'; date -u '+%Y-%m-%dT%H:%M:%SZ'; cat cypress/reports/app.log 2>/dev/null || true; cat cypress/reports/cypress-run.log 2>/dev/null || true; } > cypress/reports/diagnostics.log
kill "$APP_PID" 2>/dev/null || true
exit "$rc"