#!/usr/bin/env bash
set -uo pipefail

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

echo '===== CI: COMMIT SIGNING + GITLEAKS ====='
require_cmd node || exit 1
npm install nodemailer@9.0.3 || exit 1
repo="${GITHUB_REPOSITORY:-}"
sha="${GITHUB_SHA:-}"

if [[ -n "${GITHUB_TOKEN:-}" && -n "$repo" && "$repo" != *'unknown'* ]]; then
  node - <<'NODE'
const fs=require('fs'),https=require('https');const repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA,token=process.env.GITHUB_TOKEN;const o={hostname:'api.github.com',path:`/repos/${repo}/commits/${sha}`,headers:{'User-Agent':'Node.js','Authorization':`token ${token}`}};https.get(o,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{const v=JSON.parse(d).commit.verification||{};fs.writeFileSync('commit-signature.txt',`Commit SHA: ${sha}\nVerified: ${v.verified===true}\nReason: ${v.reason||'unknown'}\nSignature Present: ${!!v.signature}`)}catch(e){fs.writeFileSync('commit-signature.txt',`Failed to verify commit via API: ${e.message}`)}})}).on('error',e=>fs.writeFileSync('commit-signature.txt',`API request failed: ${e.message}`));
NODE
else
  git verify-commit "$sha" > commit-signature.txt 2>&1; rc=$?; { echo "Commit SHA: $sha"; echo "Verified: $([[ $rc -eq 0 ]] && echo true || echo false)"; cat commit-signature.txt; } > /tmp/csig && mv /tmp/csig commit-signature.txt
fi

if command -v gitleaks >/dev/null 2>&1; then gitleaks detect --source . --report-format sarif --report-path results.sarif; gl_rc=$?; else echo 'ERROR: gitleaks is not installed.'; gl_rc=1; fi
mkdir -p reports/security

cat > security-report.mjs <<'NODE'
const fs=require('fs');let commitLog='No signature log captured.';try{commitLog=fs.readFileSync('commit-signature.txt','utf8')}catch{}const commitStatus=commitLog.includes('Verified: true')?'Commit signature verified ✓':'Commit not signed ✗';let gitleaksStatus='❌ Leaks found',gitleaksSummary='No gitleaks report found.';try{const s=JSON.parse(fs.readFileSync('results.sarif','utf8'));const r=s.runs?.[0]?.results||[];if(!r.length){gitleaksStatus='✅ No leaks detected';gitleaksSummary='Gitleaks scanned commits and found no secrets.'}else{gitleaksStatus=`❌ ${r.length} leaks detected`;gitleaksSummary=r.map(x=>`Rule: ${x.ruleId}\nMessage: ${x.message.text}\nLocation: ${x.locations?.[0]?.physicalLocation?.artifactLocation?.uri||'unknown'}`).join('\n---\n')}}catch{gitleaksStatus='⚠️ Report missing';gitleaksSummary='Unable to parse gitleaks results.'}const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Security Report</title><style>body { background:#f9fafb; color:#111827; font-family:Arial,sans-serif; padding:24px; } .panel { background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; max-width:700px; margin:auto; box-shadow:0 2px 4px rgba(0,0,0,0.1); } h1 { font-size:20px; margin:0 0 8px; } .status { font-weight:bold; margin-bottom:8px; } .status.ok { color:#16a34a; } .status.fail { color:#dc2626; } pre { background:#f3f4f6; padding:12px; border-radius:8px; font-size:13px; overflow-x:auto; }</style></head><body><div class="panel"><h1>Commit Signing Verification</h1><div class="status ${commitStatus.includes('✓')?'ok':'fail'}">${commitStatus}</div><pre>${commitLog}</pre></div><div class="panel" style="margin-top:20px;"><h1>Gitleaks Secret Scan</h1><div class="status ${gitleaksStatus.includes('No leaks')?'ok':'fail'}">${gitleaksStatus}</div><pre>${gitleaksSummary}</pre></div></body></html>`;fs.writeFileSync('reports/security/security-report.html',html);
NODE

node security-report.mjs || true
send_mail 'CI Security Report' "${QA_EMAIL_TO:-${EMAIL_USER:-}}" "${QA_EMAIL_CC:-}" "<p><strong>Commit Verification:</strong> $(grep -q 'Verified: true' reports/security/security-report.html && echo '✓ Verified' || echo '✗ Not Signed')</p><p><strong>Gitleaks Scan:</strong> $(grep -q 'No leaks detected' reports/security/security-report.html && echo '✓ No leaks detected' || echo '❌ Leaks found')</p><p>See attached detailed report for full context.</p>" reports/security/security-report.html || true
exit "$gl_rc"