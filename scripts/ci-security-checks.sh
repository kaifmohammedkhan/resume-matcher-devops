#!/usr/bin/env bash
set -uo pipefail

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command not found: $1"; return 1; }; }

send_mail() {
  local subject="$1" to="$2" cc="$3" html="$4"; shift 4
  local attachments=("$@")
  [[ -z "${EMAIL_USER:-}" || -z "${EMAIL_PASS:-}" ]] && { echo "Email skipped: EMAIL_USER/EMAIL_PASS not configured."; return 0; }
  [[ -z "$to" ]] && to="$EMAIL_USER"

  node -e "require('nodemailer')" &>/dev/null || npm install nodemailer --no-save &>/dev/null

  node - "$subject" "$to" "$cc" "$html" "${attachments[@]}" <<'NODE'
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const [subject, to, cc, html, ...files] = process.argv.slice(2);
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

(async () => {
  const validAttachments = files
    .map(file => {
      const baseName = path.basename(file);
      const possiblePaths = [
        file,
        path.join('reports', 'security', baseName),
        path.join('reports', baseName),
        path.join(process.cwd(), baseName)
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      }
      return null;
    })
    .filter(Boolean)
    .map(p => ({ filename: path.basename(p), path: p }));

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    cc: cc || undefined,
    subject,
    html,
    attachments: validAttachments
  });
  console.log('Email sent successfully.');
})().catch(e => { console.error(e); process.exit(1); });
NODE
}

echo '===== CI: COMMIT SIGNING + GITLEAKS ====='
require_cmd node || exit 1

repo="${GITHUB_REPOSITORY:-}"
sha="${GITHUB_SHA:-}"

if [[ -n "${GITHUB_TOKEN:-}" && -n "$repo" && "$repo" != *'unknown'* ]]; then
  node - <<'NODE' || git verify-commit "$sha" > commit-signature.txt 2>&1
const fs=require('fs'),https=require('https');
const repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA,token=process.env.GITHUB_TOKEN;
const o={hostname:'api.github.com',path:`/repos/${repo}/commits/${sha}`,headers:{'User-Agent':'Node.js','Authorization':`token ${token}`}};
https.get(o,r=>{
  let d='';
  r.on('data',c=>d+=c);
  r.on('end',()=>{
    try{
      const v=JSON.parse(d).commit.verification||{};
      fs.writeFileSync('commit-signature.txt',`Commit SHA: ${sha}\nVerified: ${v.verified===true}\nReason: ${v.reason||'unknown'}\nSignature Present: ${!!v.signature}`);
    }catch(e){
      process.exit(1);
    }
  });
}).on('error',()=>process.exit(1));
NODE
else
  git verify-commit "$sha" > commit-signature.txt 2>&1 || true
  rc=$?
  { echo "Commit SHA: $sha"; echo "Verified: $([[ $rc -eq 0 ]] && echo true || echo false)"; cat commit-signature.txt 2>/dev/null || true; } > /tmp/csig && mv /tmp/csig commit-signature.txt
fi

gl_rc=0
if command -v gitleaks >/dev/null; then
  echo "Running native gitleaks..."
  gitleaks detect --source . --report-format sarif --report-path results.sarif || gl_rc=$?
else
  echo "Gitleaks not found, running via Docker..."
  docker run --rm \
    -v "$PWD:/repo" \
    zricethezav/gitleaks:latest \
    detect \
    --source /repo \
    --report-format sarif \
    --report-path results.sarif \
    --verbose || gl_rc=$?
fi

mkdir -p reports/security

cat > security-report.mjs <<'NODE'
import fs from 'fs';
let commitLog='No signature log captured.';
try{commitLog=fs.readFileSync('commit-signature.txt','utf8')}catch{}
const commitStatus=commitLog.includes('Verified: true')?'Commit signature verified ✓':'Commit not signed ✗';
let gitleaksStatus='❌ Leaks found',gitleaksSummary='No gitleaks report found.';
try{
  const s=JSON.parse(fs.readFileSync('results.sarif','utf8'));
  const r=s.runs?.[0]?.results||[];
  if(!r.length){
    gitleaksStatus='✅ No leaks detected';
    gitleaksSummary='Gitleaks scanned commits and found no secrets.';
  }else{
    gitleaksStatus=`❌ ${r.length} leaks detected`;
    gitleaksSummary=r.map(x=>`Rule: ${x.ruleId}\nMessage: ${x.message.text}\nLocation: ${x.locations?.[0]?.physicalLocation?.artifactLocation?.uri||'unknown'}`).join('\n---\n');
  }
}catch{
  gitleaksStatus='⚠️ Report missing';
  gitleaksSummary='Unable to parse gitleaks results.';
}
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Security Report</title><style>body { background:#f9fafb; color:#111827; font-family:Arial,sans-serif; padding:24px; } .panel { background:#ffffff; border:1px solid #e5e7