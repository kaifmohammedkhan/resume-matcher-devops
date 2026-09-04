#!/usr/bin/env bash
set -uo pipefail

rc_test=0 rc_sonar=0 rc_trivy=0 rc_sec=0 rc_owasp=0

./ci-owasp.sh || rc_owasp=$?
./ci-test.sh || rc_test=$?
./ci-sonarcloud.sh || rc_sonar=$?
./ci-trivy.sh || rc_trivy=$?
./ci-security-checks.sh || rc_sec=$?
./ci-email.sh || true

echo "CI RESULTS: test=$rc_test sonar=$rc_sonar trivy=$rc_trivy security=$rc_sec owasp=$rc_owasp"
(( rc_test==0 && rc_sonar==0 && rc_trivy==0 && rc_sec==0 ))