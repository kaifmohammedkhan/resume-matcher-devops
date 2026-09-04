#!/usr/bin/env bash
set -uo pipefail

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

echo '===== CI: COMBINED REPORT EMAIL ====='
send_mail 'CI Reports - Resume Matcher' "${EMAIL_USER:-}" '' '<h2>CI Pipeline Reports</h2><p><strong>Status:</strong> All jobs executed against <em>main</em> branch.</p><h3>Jest Test Suite</h3><p>See attached <em>test-summary.html</em> for full details.</p><h3>SonarCloud Security Analysis</h3><p>See attached <em>sonar-summary.html</em> for active issues report.</p><h3>Trivy Filesystem Scan</h3><p>See attached <em>trivy-fs-report.html</em> for filesystem vulnerabilities.</p><h3>Trivy Image Scan</h3><p>See attached <em>trivy-img-report.html</em> for container image vulnerabilities.</p>' reports/test-summary.html reports/sonar-summary.html reports/trivy-fs-report.html reports/trivy-img-report.html