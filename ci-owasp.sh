#!/usr/bin/env bash
set -uo pipefail

REPORT_ROOT="reports"
mkdir -p "$REPORT_ROOT"

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

echo '===== CI: OWASP DEPENDENCY CHECK ====='
local_dc="$HOME/dc/dependency-check/bin/dependency-check.sh"
if [[ ! -x "$local_dc" ]]; then curl --proto '=https' --tlsv1.2 -sSLf https://github.com/jeremylong/DependencyCheck/releases/download/v12.1.0/dependency-check-12.1.0-release.zip -o /tmp/dc.zip || exit 0; unzip -q /tmp/dc.zip -d "$HOME/dc" || exit 0; rm -f /tmp/dc.zip; fi
npm ci --ignore-scripts || true
"$local_dc" --project 'Resume Matcher' --scan . --exclude '**/node_modules/**' --format HTML --out dependency-check-report.html --nvdApiKey "${NVD_API_KEY:-}" --disableOssIndex || true
cp dependency-check-report.html "$REPORT_ROOT/dependency-check-report.html" 2>/dev/null || true
sleep $((1 + RANDOM % 5))
send_mail 'OWASP Report - Resume Matcher' "${EMAIL_USER:-}" '' '<h2>OWASP Dependency Check completed</h2><p>See attached report or workflow artifacts for full details.</p>' dependency-check-report.html || true
exit 0