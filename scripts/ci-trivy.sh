#!/usr/bin/env bash
set -uo pipefail

REPORT_ROOT="reports"
mkdir -p "$REPORT_ROOT"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command not found: $1"; return 1; }; }

send_mail() {
  local subject="$1" to="$2" cc="$3" html="$4"; shift 4
  local attachments=("$@")
  [[ -z "${EMAIL_USER:-}" || -z "${EMAIL_PASS:-}" ]] && { echo "Email skipped: EMAIL_USER/EMAIL_PASS not configured."; return 0; }
  [[ -z "$to" ]] && to="$EMAIL_USER"
  node - "$subject" "$to" "$cc" "$html" "${attachments[@]}" <<'NODE'
const nodemailer=require('nodemailer');
const fs=require('fs');
const [subject,to,cc,html,...files]=process.argv.slice(2);
const transporter=nodemailer.createTransport({service:'gmail',auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS}});
(async()=>{
  await transporter.sendMail({from:process.env.EMAIL_USER,to,cc:cc||undefined,subject,html,attachments:files.filter(fs.existsSync).map(p=>({filename:require('path').basename(p),path:p}))});
  console.log('Email sent successfully.');
})().catch(e=>{console.error(e);process.exit(1)});
NODE
}

echo '===== CI: TRIVY FILESYSTEM + IMAGE ====='
require_cmd docker || exit 1
require_cmd trivy || exit 1

curl --proto '=https' --tlsv1.2 -sSLf https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl -o html.tpl || exit 1
trivy fs --format template --template '@html.tpl' --output trivy-fs-report.html --ignore-unfixed --vuln-type os,library . || true
cp trivy-fs-report.html "$REPORT_ROOT/trivy-fs-report.html" 2>/dev/null || true
sleep $((1 + RANDOM % 5))
send_mail 'Trivy FS Report - Resume Matcher' "${EMAIL_USER:-}" '' '<h2>Trivy filesystem scan completed</h2><p>See attached report or workflow artifacts for full details.</p>' trivy-fs-report.html || true

docker build --pull --no-cache -t resume-matcher:local . || exit 1
docker images resume-matcher:local
docker history resume-matcher:local
docker image inspect resume-matcher:local >/dev/null
docker run --rm --entrypoint sh resume-matcher:local -c 'node -v; ls -la /app; ls -ld /app/node_modules; for pkg in minimatch glob brace-expansion cross-spawn tar react-router @sigstore/core sigstore; do if [ -f "/app/node_modules/$pkg/package.json" ]; then echo "$pkg"; grep "version" "/app/node_modules/$pkg/package.json"; else echo "$pkg : NOT INSTALLED"; fi; done; find /app/node_modules -type d -name tar | head -20 || true; find /app/node_modules -type d -name minimatch | head -20 || true; find /app/node_modules -type d -name brace-expansion | head -20 || true' || true

trivy --version || true
curl --proto '=https' --tlsv1.2 -sSLf https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl -o html.tpl || exit 1
TRIVY_DEBUG=true trivy image --format template --template '@html.tpl' --output trivy-img-report.html --ignore-unfixed --vuln-type os,library resume-matcher:local || true
cp trivy-img-report.html "$REPORT_ROOT/trivy-img-report.html" 2>/dev/null || true
sleep $((1 + RANDOM % 5))
send_mail 'Trivy Image Report - Resume Matcher' "${EMAIL_USER:-}" '' '<h2>Trivy image scan completed</h2><p>See attached report or workflow artifacts for full details.</p>' trivy-img-report.html || true

exit 0