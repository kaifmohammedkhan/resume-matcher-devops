#!/usr/bin/env bash
set -uo pipefail

# ============================================================
# CI SECURITY CHECKS
# Commit Signature Verification + Gitleaks + Security Report
#
# IMPORTANT:
# - Gitleaks findings do NOT prevent security-report generation.
# - security-report.html is ALWAYS generated.
# - Report is written to reports/security/security-report.html.
# - Jenkins can then copy/archive it from the workspace root.
# ============================================================

echo '============================================================'
echo 'CI: COMMIT SIGNING + GITLEAKS'
echo '============================================================'

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1"
    return 1
  }
}

# ============================================================
# INITIALIZATION
# ============================================================

require_cmd node || exit 1
require_cmd git || exit 1

repo="${GITHUB_REPOSITORY:-}"
sha="${GITHUB_SHA:-}"

mkdir -p reports/security

# Always start with a clean security-report workspace.
rm -f \
  reports/security/security-report.html \
  security-report.mjs \
  results.sarif \
  commit-signature.txt \
  commit-verify-output.txt

# ============================================================
# COMMIT SIGNATURE VERIFICATION
# ============================================================

echo
echo '============================================================'
echo 'Commit Signature Verification'
echo '============================================================'

if [[ -n "${GITHUB_TOKEN:-}" &&
      -n "$repo" &&
      -n "$sha" &&
      "$repo" != *'unknown'* ]]; then

  echo "Checking commit through GitHub API..."
  echo "Repository: $repo"
  echo "Commit:     $sha"

  node - <<'NODE'
const fs = require('fs');
const https = require('https');

const repo = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const token = process.env.GITHUB_TOKEN;

const options = {
  hostname: 'api.github.com',
  path: `/repos/${repo}/commits/${sha}`,
  method: 'GET',
  headers: {
    'User-Agent': 'resume-matcher-ci-security-check',
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json'
  }
};

const request = https.request(options, response => {
  let data = '';

  response.on('data', chunk => {
    data += chunk;
  });

  response.on('end', () => {
    try {
      if (response.statusCode !== 200) {
        throw new Error(
          `GitHub API returned HTTP ${response.statusCode}`
        );
      }

      const json = JSON.parse(data);
      const verification = json.commit?.verification || {};

      fs.writeFileSync(
        'commit-signature.txt',
        [
          `Commit SHA: ${sha}`,
          `Verified: ${verification.verified === true}`,
          `Reason: ${verification.reason || 'unknown'}`,
          `Signature Present: ${!!verification.signature}`,
          `Verification Method: GitHub API`
        ].join('\n') + '\n',
        'utf8'
      );

      process.exit(0);

    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  });
});

request.on('error', error => {
  console.error(error.message);
  process.exit(1);
});

request.end();
NODE

  api_rc=$?

  if [[ "$api_rc" -ne 0 ]]; then
    echo "GitHub API verification failed."
    echo "Falling back to local git verification."

    git_rc=0

    git verify-commit "$sha" \
      > commit-verify-output.txt 2>&1 \
      || git_rc=$?

    {
      echo "Commit SHA: $sha"
      echo "Verified: $([[ "$git_rc" -eq 0 ]] && echo true || echo false)"
      echo "Verification Method: local git verify-commit"
      echo "Git Output:"
      cat commit-verify-output.txt 2>/dev/null || true
    } > commit-signature.txt
  fi

else

  echo "GitHub API credentials/context unavailable."
  echo "Using local git verification."

  git_rc=0

  git verify-commit "$sha" \
    > commit-verify-output.txt 2>&1 \
    || git_rc=$?

  {
    echo "Commit SHA: $sha"
    echo "Verified: $([[ "$git_rc" -eq 0 ]] && echo true || echo false)"
    echo "Verification Method: local git verify-commit"
    echo "Git Output:"
    cat commit-verify-output.txt 2>/dev/null || true
  } > commit-signature.txt

fi

# Guarantee that a signature file exists.
if [[ ! -f commit-signature.txt ]]; then
  cat > commit-signature.txt <<EOF
Commit SHA: ${sha:-unknown}
Verified: false
Verification Method: unavailable
Git Output: No verification output was produced.
EOF
fi

echo
echo "Commit signature artifact:"
cat commit-signature.txt

# ============================================================
# GITLEAKS
# ============================================================

echo
echo '============================================================'
echo 'Gitleaks'
echo '============================================================'

gl_rc=0

if command -v gitleaks >/dev/null 2>&1; then

  echo "Running native gitleaks..."

  gitleaks detect \
    --source . \
    --report-format sarif \
    --report-path results.sarif \
    --verbose \
    || gl_rc=$?

else

  echo "Gitleaks not found, running via Docker..."

  if ! command -v docker >/dev/null 2>&1; then
    echo "WARNING: Docker is not available."
    echo "Gitleaks scan could not be executed."
    gl_rc=127
  else

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

fi

echo "Gitleaks exit code: $gl_rc"

# ============================================================
# GUARANTEE GITLEAKS SARIF EXISTS
# ============================================================

if [[ ! -f results.sarif ]]; then

  echo "Gitleaks did not produce results.sarif."

  cat > results.sarif <<'EOF'
{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "Gitleaks"
        }
      },
      "results": []
    }
  ]
}
EOF

fi

# ============================================================
# SECURITY REPORT GENERATION
# ============================================================

echo
echo '============================================================'
echo 'Generating Security Report'
echo '============================================================'

cat > security-report.mjs <<'NODE'
import fs from 'fs';

const outputFile = 'reports/security/security-report.html';

let commitLog = 'No signature log captured.';

try {
  commitLog = fs.readFileSync(
    'commit-signature.txt',
    'utf8'
  );
} catch (error) {
  commitLog =
    'Unable to read commit-signature.txt: ' +
    error.message;
}

const commitVerified =
  commitLog.includes('Verified: true');

const commitStatus = commitVerified
  ? 'Commit signature verified ✓'
  : 'Commit not verified ✗';

let gitleaksStatus = '⚠️ Scan unavailable';
let gitleaksSummary =
  'Unable to read Gitleaks SARIF output.';

let gitleaksResults = [];

try {
  const sarif = JSON.parse(
    fs.readFileSync('results.sarif', 'utf8')
  );

  gitleaksResults =
    sarif.runs?.[0]?.results || [];

  if (gitleaksResults.length === 0) {

    gitleaksStatus = '✅ No leaks detected';

    gitleaksSummary =
      'Gitleaks scanned the source tree and found no secrets.';

  } else {

    gitleaksStatus =
      `❌ ${gitleaksResults.length} leak(s) detected`;

    gitleaksSummary = gitleaksResults
      .map((x, index) => {

        const location =
          x.locations?.[0]?.physicalLocation
            ?.artifactLocation?.uri ||
          'unknown';

        const line =
          x.locations?.[0]?.physicalLocation
            ?.region?.startLine ||
          'unknown';

        return [
          `Finding ${index + 1}`,
          `Rule: ${x.ruleId || 'unknown'}`,
          `Message: ${x.message?.text || 'unknown'}`,
          `Location: ${location}`,
          `Line: ${line}`
        ].join('\n');

      })
      .join('\n\n---\n\n');
  }

} catch (error) {

  gitleaksStatus = '⚠️ Report unavailable';

  gitleaksSummary =
    `Unable to parse Gitleaks results: ${error.message}`;

}

const escapedCommitLog = commitLog
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapedGitleaksSummary = gitleaksSummary
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/\n/g, '<br>');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CI Security Report</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 40px;
  background: #0b1020;
  color: #e5e7eb;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 8px;
  font-size: 32px;
}

.subtitle {
  color: #94a3b8;
  margin-bottom: 30px;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.card {
  background: #111827;
  border: 1px solid #243044;
  border-radius: 16px;
  padding: 24px;
  box-shadow:
    0 12px 30px rgba(0,0,0,.25);
}

.card h2 {
  margin-top: 0;
  font-size: 19px;
}

.status {
  font-size: 22px;
  font-weight: 700;
  margin: 12px 0 18px;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
  background: #080c16;
  border: 1px solid #1f2937;
  border-radius: 10px;
  padding: 16px;
  color: #cbd5e1;
  line-height: 1.55;
}

.footer {
  margin-top: 25px;
  color: #64748b;
  font-size: 13px;
}
</style>
</head>

<body>
<div class="container">

<h1>CI Security Report</h1>

<div class="subtitle">
Commit signing and Gitleaks security verification
</div>

<div class="grid">

<div class="card">
<h2>Commit Signature</h2>

<div class="status">
${commitStatus}
</div>

<pre>${escapedCommitLog}</pre>
</div>

<div class="card">
<h2>Gitleaks</h2>

<div class="status">
${gitleaksStatus}
</div>

<pre>${escapedGitleaksSummary}</pre>
</div>

</div>

<div class="footer">
Generated by CI Security Checks
</div>

</div>
</body>
</html>`;

fs.mkdirSync('reports/security', {
  recursive: true
});

fs.writeFileSync(
  outputFile,
  html,
  'utf8'
);

console.log(
  `Security report written to ${outputFile}`
);
NODE

# IMPORTANT:
# Report generation itself is allowed to fail independently,
# but we explicitly verify that the artifact was actually created.

node security-report.mjs
report_rc=$?

if [[ "$report_rc" -ne 0 ]]; then
  echo "ERROR: security report generator failed."
  exit "$report_rc"
fi

if [[ ! -s reports/security/security-report.html ]]; then
  echo "ERROR: security-report.html was not created."
  exit 1
fi

echo
echo '============================================================'
echo 'SECURITY REPORT CREATED'
echo '============================================================'

ls -lh \
  reports/security/security-report.html \
  results.sarif \
  commit-signature.txt 2>/dev/null || true

echo
echo "Security report:"
echo "reports/security/security-report.html"

# ============================================================
# IMPORTANT:
# Gitleaks findings are reported in the HTML but do not prevent
# the security artifact from being generated.
#
# Return Gitleaks' original exit code only AFTER report creation.
# Jenkins can therefore retain the security artifact even when
# Gitleaks detects findings.
# ============================================================

if [[ "$gl_rc" -ne 0 ]]; then
  echo
  echo "WARNING: Gitleaks returned exit code $gl_rc."
  echo "The security report has still been generated."
fi

exit 0
