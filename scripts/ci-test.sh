#!/usr/bin/env bash
set -uo pipefail

REPORT_ROOT="reports"
mkdir -p "$REPORT_ROOT"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command not found: $1"; return 1; }; }

echo '===== CI: UNIT TESTS & COVERAGE ====='
require_cmd npm || exit 1
npm ci --ignore-scripts || exit 1
npm test --silent=false 2>&1 | tee console.log
TEST_EXIT_CODE=${PIPESTATUS[0]}
export TEST_EXIT_CODE
echo "TEST_EXIT_CODE=$TEST_EXIT_CODE"
if [[ -f coverage/lcov.info ]]; then :; else echo 'ERROR: coverage/lcov.info was not found.'; fi

cat > generate-test-report.mjs <<'NODE'

import fs from "fs";

const LOG_FILE = "console.log";
const COVERAGE_FILE = "coverage/coverage-summary.json";
const OUTPUT_FILE = "test-summary.html";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripAnsi(value = "") {
  return String(value).replace(
    /\u001B(?:[@-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

const rawLog = readFileSafe(LOG_FILE);
const cleanLog = stripAnsi(rawLog);

const repository =
  process.env.GITHUB_REPOSITORY ||
  "Unknown repository";

const branch =
  process.env.GITHUB_REF_NAME ||
  "Unknown branch";

const commit =
  process.env.GITHUB_SHA
    ? process.env.GITHUB_SHA.substring(0, 7)
    : "Unknown";

const workflowRun =
  process.env.GITHUB_RUN_NUMBER ||
  "Unknown";

const runId =
  process.env.GITHUB_RUN_ID ||
  "Unknown";

const serverUrl =
  process.env.GITHUB_SERVER_URL ||
  "https://github.com";

const repositoryUrl =
  `${serverUrl}/${repository}`;

const actionsUrl =
  `${repositoryUrl}/actions/runs/${runId}`;

const exitCode =
  Number(process.env.TEST_EXIT_CODE ?? 1);

const testPassed =
  exitCode === 0;

const testStatus =
  testPassed
    ? "PASSED"
    : "FAILED";

const statusBackground =
  testPassed
    ? "#dcfce7"
    : "#fee2e2";

const statusColor =
  testPassed
    ? "#166534"
    : "#991b1b";

const logLines =
  cleanLog.split(/\r?\n/);

function findLine(prefix) {
  return (
    logLines.find((line) =>
      line.trim().startsWith(prefix)
    ) || ""
  );
}

const suiteLine =
  findLine("Test Suites:");

const testsLine =
  findLine("Tests:");

const snapshotsLine =
  findLine("Snapshots:");

const timeLine =
  findLine("Time:");

function metric(line, word) {
  const regex =
    new RegExp(
      `(\\d+)\\s+${word}`,
      "i"
    );

  const match =
    line.match(regex);

  return match
    ? match[1]
    : "0";
}

function totalFromLine(line) {
  const match =
    line.match(
      /(?:of\s+)?(\d+)\s+total/i
    );

  return match
    ? match[1]
    : "0";
}

const suitesPassed =
  metric(
    suiteLine,
    "passed"
  );

const suitesFailed =
  metric(
    suiteLine,
    "failed"
  );

const suitesTotal =
  totalFromLine(
    suiteLine
  );

const testsPassed =
  metric(
    testsLine,
    "passed"
  );

const testsFailed =
  metric(
    testsLine,
    "failed"
  );

const testsTotal =
  totalFromLine(
    testsLine
  );

const snapshots =
  snapshotsLine.trim() ||
  "Snapshots: N/A";

const executionTime =
  timeLine.trim() ||
  "Time: N/A";

let coverage = null;

if (fs.existsSync(COVERAGE_FILE)) {
  try {
    coverage =
      JSON.parse(
        fs.readFileSync(
          COVERAGE_FILE,
          "utf8"
        )
      );
  } catch (error) {
    console.log(
      "Unable to parse coverage-summary.json:",
      error.message
    );
  }
}

function coveragePercent(
  section,
  key
) {
  if (
    !section ||
    !section[key]
  ) {
    return "N/A";
  }

  const value =
    section[key].pct;

  if (
    value === undefined ||
    value === null
  ) {
    return "N/A";
  }

  return `${value}%`;
}

function coverageUncovered(
  section,
  key
) {
  if (
    !section ||
    !section[key]
  ) {
    return "0";
  }

  return String(
    section[key].uncovered ??
    0
  );
}

const totalCoverage =
  coverage?.total || null;

const statements =
  coveragePercent(
    totalCoverage,
    "statements"
  );

const branches =
  coveragePercent(
    totalCoverage,
    "branches"
  );

const functions =
  coveragePercent(
    totalCoverage,
    "functions"
  );

const linesCoverage =
  coveragePercent(
    totalCoverage,
    "lines"
  );

const statementsUncovered =
  coverageUncovered(
    totalCoverage,
    "statements"
  );

const branchesUncovered =
  coverageUncovered(
    totalCoverage,
    "branches"
  );

const functionsUncovered =
  coverageUncovered(
    totalCoverage,
    "functions"
  );

const linesUncovered =
  coverageUncovered(
    totalCoverage,
    "lines"
  );

let coverageRows = "";

if (
  coverage &&
  typeof coverage === "object"
) {
  const entries =
    Object.entries(
      coverage
    )
    .filter(
      ([key]) =>
        key !== "total"
    )
    .sort(
      (a, b) =>
        Number(
          b[1]?.lines?.uncovered ??
          0
        ) -
        Number(
          a[1]?.lines?.uncovered ??
          0
        )
    );

  for (
    const [file, data]
    of entries
  ) {
    const stmts =
      coveragePercent(
        data,
        "statements"
      );

    const branch =
      coveragePercent(
        data,
        "branches"
      );

    const funcs =
      coveragePercent(
        data,
        "functions"
      );

    const lines =
      coveragePercent(
        data,
        "lines"
      );

    const uncovered =
      coverageUncovered(
        data,
        "lines"
      );

    const uncoveredExists =
      Number(uncovered) > 0;

    coverageRows += `
      <tr class="${
        uncoveredExists
          ? "uncovered"
          : "covered"
      }">
        <td>${escapeHtml(file)}</td>
        <td>${escapeHtml(stmts)}</td>
        <td>${escapeHtml(branch)}</td>
        <td>${escapeHtml(funcs)}</td>
        <td>${escapeHtml(lines)}</td>
        <td>${escapeHtml(uncovered)}</td>
      </tr>
    `;
  }
}

if (!coverageRows) {
  coverageRows = `
    <tr>
      <td colspan="6">
        No coverage-summary.json was generated.
        Check the coverage artifact.
      </td>
    </tr>
  `;
}

const highlights =
  logLines
    .filter((line) =>
      /PASS |FAIL |Test Suites:|Tests:|Snapshots:|Time:|Coverage summary|console\.error|console\.warn|console\.log/i.test(
        line
      )
    )
    .slice(-200)
    .join("\n") ||
  "No console highlights found.";

const coverageAvailable =
  Boolean(
    coverage &&
    coverage.total
  );

const coverageStatus =
  coverageAvailable
    ? "Coverage data available"
    : "Coverage data unavailable";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jest Test & Coverage Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f7fb; color: #1f2937; font-family: Arial, Helvetica, sans-serif; }
    .container { max-width: 1600px; margin: auto; padding: 30px; }
    .header, .section, .card { background: white; border-radius: 16px; box-shadow: 0 4px 18px rgba(0,0,0,0.06); }
    .header { padding: 28px; margin-bottom: 24px; }
    h1 { margin-top: 0; }
    .metadata { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 20px; }
    .metadata div { background: #f9fafb; padding: 14px; border-radius: 10px; }
    .metadata strong { display: block; margin-bottom: 5px; }
    .status { display: inline-block; margin-top: 18px; padding: 9px 18px; border-radius: 999px; font-weight: bold; background: ${statusBackground}; color: ${statusColor}; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 18px; margin-bottom: 24px; }
    .card { padding: 22px; }
    .label { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .value { font-size: 26px; font-weight: bold; }
    .section { padding: 24px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; padding: 10px; }
    td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr.uncovered td:last-child { color: #dc2626; font-weight: bold; }
    tr.covered td:last-child { color: #16a34a; }
    tr.total-row { background: #f9fafb; }
    .code { background: #111827; color: #e5e7eb; padding: 16px; border-radius: 10px; white-space: pre-wrap; overflow-x: auto; max-height: 450px; overflow-y: auto; }
    .links a { color: #2563eb; text-decoration: none; font-weight: bold; }
    .links a:hover { text-decoration: underline; }
    .success { color: #166534; }
    .danger { color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Jest Test & Coverage Report</h1>
      <p>Real-time test execution and coverage generated from the current GitHub Actions run.</p>
      <div class="metadata">
        <div><strong>Repository</strong>${escapeHtml(repository)}</div>
        <div><strong>Branch</strong>${escapeHtml(branch)}</div>
        <div><strong>Commit</strong>${escapeHtml(commit)}</div>
        <div><strong>Workflow Run</strong>#${escapeHtml(workflowRun)}</div>
      </div>
      <div class="status">${escapeHtml(testStatus)}</div>
    </div>
    <div class="cards">
      <div class="card"><div class="label">Test Suites</div><div class="value">${escapeHtml(suitesPassed)} / ${escapeHtml(suitesTotal)}</div></div>
      <div class="card"><div class="label">Tests</div><div class="value">${escapeHtml(testsPassed)} / ${escapeHtml(testsTotal)}</div></div>
      <div class="card"><div class="label">Failed Suites</div><div class="value danger">${escapeHtml(suitesFailed)}</div></div>
      <div class="card"><div class="label">Failed Tests</div><div class="value danger">${escapeHtml(testsFailed)}</div></div>
      <div class="card"><div class="label">Execution Time</div><div class="value">${escapeHtml(executionTime)}</div></div>
    </div>
    <div class="section">
      <h2>📊 Overall Coverage</h2>
      <p>${escapeHtml(coverageStatus)}</p>
      <table>
        <tr><th>Metric</th><th>Coverage</th><th>Uncovered</th></tr>
        <tr><td><strong>Statements</strong></td><td>${escapeHtml(statements)}</td><td>${escapeHtml(statementsUncovered)}</td></tr>
        <tr><td><strong>Branches</strong></td><td>${escapeHtml(branches)}</td><td>${escapeHtml(branchesUncovered)}</td></tr>
        <tr><td><strong>Functions</strong></td><td>${escapeHtml(functions)}</td><td>${escapeHtml(functionsUncovered)}</td></tr>
        <tr><td><strong>Lines</strong></td><td>${escapeHtml(linesCoverage)}</td><td>${escapeHtml(linesUncovered)}</td></tr>
      </table>
    </div>
    <div class="section">
      <h2>📁 Full Coverage Breakdown</h2>
      <p>Actual file-level coverage generated by Jest.</p>
      <table>
        <tr><th>File</th><th>% Statements</th><th>% Branches</th><th>% Functions</th><th>% Lines</th><th>Uncovered Lines</th></tr>
        ${coverageRows}
      </table>
    </div>
    <div class="section">
      <h2>🔗 GitHub Run</h2>
      <div class="links">
        <p><a href="${escapeHtml(repositoryUrl)}" target="_blank">Open Repository</a></p>
        <p><a href="${escapeHtml(actionsUrl)}" target="_blank">Open This GitHub Actions Run</a></p>
      </div>
    </div>
    <div class="section">
      <h2>📦 Coverage Artifacts</h2>
      <table>
        <tr><th>Artifact</th><th>Location</th></tr>
        <tr><td>LCOV</td><td><code>coverage/lcov.info</code></td></tr>
        <tr><td>Coverage JSON</td><td><code>coverage/coverage-summary.json</code></td></tr>
        <tr><td>HTML Coverage</td><td><code>coverage/lcov-report/index.html</code></td></tr>
      </table>
    </div>
    <div class="section">
      <h2>🖥️ Console Output Highlights</h2>
      <pre class="code">${escapeHtml(highlights)}</pre>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(OUTPUT_FILE, html, "utf8");
console.log(`Generated ${OUTPUT_FILE}`);
console.log(`Coverage file present: ${coverageAvailable}`);
console.log(`Test exit code: ${exitCode}`);
NODE

node generate-test-report.mjs || true
cp test-summary.html "$REPORT_ROOT/test-summary.html" 2>/dev/null || true
exit "$TEST_EXIT_CODE"