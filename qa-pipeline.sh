#!/usr/bin/env bash
set -uo pipefail

c=0 s=0 l=0
./qa-cypress.sh || c=$?
export CYPRESS_RESULT=$([[ $c -eq 0 ]] && echo success || echo failure)

rm -rf results; ./qa-k6-smoke.sh || s=$?
export K6_SMOKE_RESULT=$([[ $s -eq 0 ]] && echo success || echo failure)

rm -rf results; ./qa-k6-load.sh || l=$?
export K6_LOAD_RESULT=$([[ $l -eq 0 ]] && echo success || echo failure)

./qa-report.sh || true
echo "QA RESULTS: cypress=$c smoke=$s load=$l"
(( c==0 && s==0 && l==0 ))