#!/usr/bin/env bash
set -uo pipefail

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1"
    return 1
  }
}

send_mail() {
  local subject="$1" to="$2" cc="$3" html="$4"
  shift 4
  local attachments=("$@")

  [[ -z "${EMAIL_USER:-}" || -z "${EMAIL_PASS:-}" ]] && {
    echo "Email skipped: EMAIL_USER/EMAIL_PASS not configured."
    return 0
  }

  [[ -z "$to" ]] && to="$EMAIL_USER"

  node -e "require('nodemailer')" &>/dev/null ||
    npm install nodemailer --no-save &>/dev/null

  node - "$subject" "$to" "$cc" "$html" "${attachments[@]}" <<'NODE'
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const [subject, to, cc, html, ...files] = process.argv.slice(2);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
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
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return p;
        }
      }

      return null;
    })
    .filter(Boolean)
    .map(p => ({
      filename: path.basename(p),
      path: p
    }));

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    cc: cc || undefined,
    subject,
    html,
    attachments: validAttachments
  });

  console.log('Email sent successfully.');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
NODE
}

echo '===== CI: COMMIT SIGNING + GITLEAKS ====='

require_cmd node || exit 1

repo="${GITHUB_REPOSITORY:-}"
sha="${GITHUB_SHA:-}"

# ============================================================
# COMMIT SIGNATURE VERIFICATION
# ============================================================

if [[ -n "${GITHUB_TOKEN:-}" && -n "$repo" && "$repo" != *'unknown'* ]]; then

  node - <<'NODE'
const fs = require('fs');
const https = require('https');

const repo = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const token = process.env.GITHUB_TOKEN;

const options = {
  hostname: 'api.github.com',
  path: `/repos/${repo}/commits/${sha}`,
  headers: {
    'User-Agent': 'Node.js',
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json'
  }
};

https.get(options, response => {
  let data = '';

  response.on('data', chunk => {
    data += chunk;
  });

  response.on('end', () => {
    try {
      if (response.statusCode !== 200) {
        throw new Error(`GitHub API returned HTTP ${response.statusCode}`);
      }

      const json = JSON.parse(data);
      const verification = json.commit?.verification || {};

      fs.writeFileSync(
        'commit-signature.txt',
        [
          `Commit SHA: ${sha}`,
          `Verified: ${verification.verified === true}`,
          `Reason: ${verification.reason || 'unknown'}`,
          `Signature Present: ${!!verification.signature}`
        ].join('\n') + '\n'
      );
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  });
}).on('error', error => {
  console.error(error.message);
  process.exit(1);
});
NODE

  api_rc=$?

  if [[ "$api_rc" -ne 0 ]]; then
    echo "GitHub API verification failed; falling back to local git verification."

    git_rc=0
    git verify-commit "$sha" > commit-verify-output.txt 2>&1 || git_rc=$?

    {
      echo "Commit SHA: $sha"
      echo "Verified: $([[ "$git_rc" -eq 0 ]] && echo true || echo false)"
      echo "Verification Method: local git verify-commit"
      echo "Git Output:"
      cat commit-verify-output.txt 2>/dev/null || true
    } > commit-signature.txt
  fi

else

  git_rc=0
  git verify-commit "$sha" > commit-verify-output.txt 2>&1 || git_rc=$?

  {
    echo "Commit SHA: $sha"
    echo "Verified: $([[ "$git_rc" -eq 0 ]] && echo true || echo false)"
    echo "Verification Method: local git verify-commit"
    echo "Git Output:"
    cat commit-verify-output.txt 2>/dev/null || true
  } > commit-signature.txt

fi

# ============================================================
# GITLEAKS
# ============================================================

gl_rc=0

if command -v gitleaks >/dev/null 2>&1; then

  echo "Running native gitleaks..."

  gitleaks detect \
    --source . \
    --report-format sarif \
    --report-path results.sarif \
    || gl_rc=$?

else

  echo "Gitleaks not found, running via Docker..."

  docker run --rm \
    -v "$PWD:/repo" \
    -w /repo \
    zricethezav/gitleaks:latest \
    detect \
    --source /repo \
    --report-format sarif \
    --report-path /repo/results.sarif \
    --verbose \
    || gl_rc=$?

fi

echo "Gitleaks exit code: $gl_rc"

# ============================================================
# SECURITY REPORT
# ============================================================

mkdir -p reports/security

cat > security-report.mjs <<'NODE'
import fs from 'fs';

let commitLog = 'No signature log captured.';

try {
  commitLog = fs.readFileSync(
    'commit-signature.txt',
    'utf8'
  );
} catch {}

const commitStatus =
  commitLog.includes('Verified: true')
    ? 'Commit signature verified ✓'
    : 'Commit not verified ✗';

let gitleaksStatus = '❌ Leaks found';
let gitleaksSummary = 'No gitleaks report found.';

try {
  const sarif = JSON.parse(
    fs.readFileSync('results.sarif', 'utf8')
  );

  const results =
    sarif.runs?.[0]?.results || [];

  if (!results.length) {
    gitleaksStatus = '✅ No leaks detected';
    gitleaksSummary =
      'Gitleaks scanned the source tree and found no secrets.';
  } else {
    gitleaksStatus =
      `❌ ${results.length} leaks detected`;

    gitleaksSummary = results
      .map(x =>
        [
          `Rule: ${x.ruleId || 'unknown'}`,
          `Message: ${x.message?.text || 'unknown'}`,
          `Location: ${
            x.locations?.[0]?.physicalLocation
              ?.artifactLocation?.uri || 'unknown'
          }`
        ].join('\n')
      )
      .join('\n---\n');
  }

} catch {
  gitleaksStatus = '⚠️ Report missing';
  gitleaksSummary =
    'Unable to parse gitleaks results.';
}

const html = `<!doctype html>
<html lang="en">
<head>
...
</head>
<body>
...
</body>
</html>`;

fs.writeFileSync(
  'reports/security/security-report.html',
  html,
  'utf8'
);

console.log(
  'Security report written to reports/security/security-report.html'
);
NODE

node security-report.mjs
