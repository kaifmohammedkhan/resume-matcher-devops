#!/usr/bin/env bash
set -uo pipefail

send_mail() {
  local subject="$1" to="$2" cc="$3" html="$4"
  shift 4

  local attachments=("$@")

  # ============================================================
  # EMAIL CONFIGURATION CHECK
  # ============================================================

  if [[ -z "${EMAIL_USER:-}" || -z "${EMAIL_PASS:-}" ]]; then
    echo "Email skipped: EMAIL_USER/EMAIL_PASS not configured."
    return 0
  fi

  if [[ -z "$to" ]]; then
    to="$EMAIL_USER"
  fi

  # ============================================================
  # NODEMAILER
  #
  # Do not assume nodemailer is already installed on the Jenkins
  # GitHub Actions cloud runner.
  #
  # Install locally without modifying package.json/package-lock.json.
  # ============================================================

  echo "============================================================"
  echo "Checking Nodemailer"
  echo "============================================================"

  if ! node -e "require('nodemailer')" >/dev/null 2>&1; then
    echo "Nodemailer is not installed. Installing locally..."

    if ! npm install --no-save --no-package-lock nodemailer; then
      echo "ERROR: Failed to install nodemailer."
      return 1
    fi
  fi

  if ! node -e "require('nodemailer')" >/dev/null 2>&1; then
    echo "ERROR: nodemailer is still unavailable after installation."
    return 1
  fi

  echo "Nodemailer is available."

  # ============================================================
  # VERIFY ATTACHMENTS BEFORE SENDING
  #
  # The Jenkins email stage places all reports in the workspace
  # root, but these fallbacks also preserve compatibility with
  # the existing report locations.
  # ============================================================

  echo "============================================================"
  echo "Checking Email Attachments"
  echo "============================================================"

  for file in "${attachments[@]}"; do
    base_name="$(basename "$file")"

    found_path=""

    possible_paths=(
      "$file"
      "$base_name"
      "reports/$base_name"
      "reports/security/$base_name"
      "$(pwd)/$base_name"
    )

    for candidate in "${possible_paths[@]}"; do
      if [[ -f "$candidate" && -s "$candidate" ]]; then
        found_path="$candidate"
        break
      fi
    done

    if [[ -z "$found_path" ]]; then
      echo "ERROR: Required email attachment not found: $base_name"
      return 1
    fi

    echo "FOUND: $found_path"
  done

  # ============================================================
  # SEND EMAIL
  # ============================================================

  echo "============================================================"
  echo "Sending Email"
  echo "============================================================"

  node - "$subject" "$to" "$cc" "$html" "${attachments[@]}" <<'NODE'
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const [subject, to, cc, html, ...files] = process.argv.slice(2);

function resolveAttachment(file) {
  const baseName = path.basename(file);

  const possiblePaths = [
    file,
    baseName,
    path.join('reports', baseName),
    path.join('reports', 'security', baseName),
    path.join(process.cwd(), baseName)
  ];

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  throw new Error(`Required attachment not found: ${baseName}`);
}

const resolvedAttachments = files.map(resolveAttachment);

console.log(
  'Attaching files:',
  resolvedAttachments
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

(async () => {
  await transporter.verify();

  console.log('SMTP connection verified.');

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    cc: cc || undefined,
    subject,
    html,
    attachments: resolvedAttachments.map(file => ({
      filename: path.basename(file),
      path: file
    }))
  });

  console.log('Email sent successfully.');
})().catch(error => {
  console.error('ERROR: Email delivery failed.');
  console.error(error);
  process.exit(1);
});
NODE

  local mail_status=$?

  if [[ "$mail_status" -ne 0 ]]; then
    echo "ERROR: Email sending failed."
    return "$mail_status"
  fi

  echo "Email delivery completed successfully."
  return 0
}


echo '============================================================'
echo 'CI: COMBINED REPORT EMAIL'
echo '============================================================'

send_mail \
  'CI Reports - Resume Matcher' \
  "${EMAIL_USER:-}" \
  '' \
'
<h2>CI Pipeline Reports</h2>

<p>
  <strong>Status:</strong>
  All CI, Security and OWASP report jobs executed successfully.
</p>

<h3>Jest Test Suite</h3>
<p>
  See attached <em>test-summary.html</em> for full test details.
</p>

<h3>SonarCloud Security Analysis</h3>
<p>
  See attached <em>sonar-summary.html</em> for the SonarCloud analysis summary.
</p>

<h3>Trivy Filesystem Scan</h3>
<p>
  See attached <em>trivy-fs-report.html</em> for filesystem vulnerability findings.
</p>

<h3>Trivy Image Scan</h3>
<p>
  See attached <em>trivy-img-report.html</em> for container image vulnerability findings.
</p>

<h3>Security & Commit Scan</h3>
<p>
  See attached <em>security-report.html</em> for commit signature and Gitleaks security results.
</p>

<h3>OWASP Dependency Check</h3>
<p>
  See attached <em>dependency-check-report.html</em> for third-party dependency vulnerability findings.
</p>

<hr>

<p>
  <strong>Repository:</strong> resume-matcher-devops
</p>

<p>
  <strong>Branch:</strong> pre-main
</p>
' \
  test-summary.html \
  sonar-summary.html \
  trivy-fs-report.html \
  trivy-img-report.html \
  security-report.html \
  dependency-check-report.html

exit $?
