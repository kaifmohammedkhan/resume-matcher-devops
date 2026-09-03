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

echo '===== QA: COMBINED REPORTS ====='
mkdir -p reports/html reports/k6-smoke reports/k6-load reports/cypress
[[ -d cypress/reports ]] && cp -a cypress/reports/. reports/cypress/ 2>/dev/null || true
[[ -d results ]] && { cp -a results/. reports/k6-load/ 2>/dev/null || true; }

export CYPRESS_RESULT="${CYPRESS_RESULT:-unknown}"
export K6_SMOKE_RESULT="${K6_SMOKE_RESULT:-unknown}"
export K6_LOAD_RESULT="${K6_LOAD_RESULT:-unknown}"

cat > generate-qa-report.mjs <<'NODE'
const fs = require("fs");
const path = require("path");

const env = process.env;

const repo = env.REPOSITORY || "N/A";
const branch = env.BRANCH || "N/A";
const commit = env.COMMIT || "N/A";
const runNumber = env.RUN_NUMBER || "N/A";
const actor = env.ACTOR || "N/A";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findFiles(root, predicate) {
  const found = [];
  if (!fs.existsSync(root)) return found;
  function walk(current) {
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (predicate(full, entry.name)) found.push(full);
    }
  }
  walk(root);
  return found;
}

function firstFile(root, names) {
  const wanted = new Set(names);
  return findFiles(root, (_, name) => wanted.has(name))[0] || null;
}

function readText(file, fallback = "") {
  if (!file || !fs.existsSync(file)) return fallback;
  try { return fs.readFileSync(file, "utf8"); } catch { return fallback; }
}

function number(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }
function formatNumber(value) { const n = number(value); return n === null ? "N/A" : n.toLocaleString("en-US"); }
function formatMs(value) { const n = number(value); return n === null ? "N/A" : `${n.toFixed(2)} ms`; }
function formatPercent(value) { const n = number(value); return n === null ? "N/A" : `${(n * 100).toFixed(2)}%`; }

function executionLabel(result) {
  const value = String(result || "unknown").toLowerCase();
  if (value === "success") return "EXECUTION PASSED";
  if (value === "failure") return "EXECUTION FAILED";
  if (value === "skipped") return "SKIPPED";
  return value.toUpperCase();
}

const styles = `
  :root { --bg: #0b1220; --panel: #111827; --panel2: #0f172a; --border: #263449; --text: #f8fafc; --muted: #94a3b8; --accent: #38bdf8; --good: #34d399; --bad: #f87171; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; background: var(--bg); color: var(--text); font-family: sans-serif; line-height: 1.5; }
  .container { max-width: 1120px; margin: 0 auto; background: var(--panel); border: 1px solid var(--border); border-radius: 18px; padding: 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
  h1 { margin: 0; font-size: 25px; }
  .subtitle { color: var(--muted); margin-top: 5px; }
  .badges { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .badge { display: inline-flex; align-items: center; padding: 7px 11px; border-radius: 999px; border: 1px solid var(--border); font-size: 11px; font-weight: 800; letter-spacing: .05em; white-space: nowrap; }
  .success { color: var(--good); background: rgba(52,211,153,.10); border-color: rgba(52,211,153,.35); }
  .failure { color: var(--bad); background: rgba(248,113,113,.10); border-color: rgba(248,113,113,.35); }
  .neutral { color: var(--muted); background: rgba(148,163,184,.08); }
  .meta, .cards { display: grid; gap: 12px; }
  .meta { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 20px; }
  .meta-card, .metric { background: var(--panel2); border: 1px solid var(--border); border-radius: 12px; padding: 13px; }
  .label { display: block; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
  .value { font-weight: 700; word-break: break-word; }
  .cards { grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); margin-top: 18px; }
  .metric .value { color: var(--accent); font-size: 22px; }
  .metric.good .value { color: var(--good); }
  .metric.bad .value { color: var(--bad); }
  details { margin-top: 18px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  summary { cursor: pointer; padding: 12px 14px; color: var(--muted); font-weight: 700; }
  pre { margin: 0; padding: 16px; background: #020617; color: #cbd5e1; overflow: auto; max-height: 520px; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }
`;

function metric(label, value, className = "") {
  return `<div class="metric ${className}"><span class="label">${escapeHtml(label)}</span><div class="value">${escapeHtml(value)}</div></div>`;
}

function meta(label, value) {
  return `<div class="meta-card"><span class="label">${escapeHtml(label)}</span><div class="value">${escapeHtml(value)}</div></div>`;
}

function page(title, badges, content, footer) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body><main class="container"><div class="header"><div><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(repo)} · ${escapeHtml(branch)} · #${escapeHtml(runNumber)}</div></div><div class="badges">${badges}</div></div>${content}<div class="footer">${footer}</div></main></body></html>`;
}

// CYPRESS REPORT
const cypressRoot = "reports/cypress";
const cypressXmlFiles = findFiles(cypressRoot, (_, name) => name.endsWith(".xml"));
let cypTests = null, cypFailures = null, cypErrors = null, cypSkipped = null, cypTime = null, cypSuites = 0;

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? match[1] : null;
}

for (const xmlFile of cypressXmlFiles) {
  const xml = readText(xmlFile);
  const suiteTags = xml.match(/<testsuite\b[^>]*>/gi) || [];
  for (const tag of suiteTags) {
    cypSuites += 1;
    cypTests = (cypTests ?? 0) + Number(attr(tag, "tests") || 0);
    cypFailures = (cypFailures ?? 0) + Number(attr(tag, "failures") || 0);
    cypErrors = (cypErrors ?? 0) + Number(attr(tag, "errors") || 0);
    cypSkipped = (cypSkipped ?? 0) + Number(attr(tag, "skipped") || 0);
    cypTime = (cypTime ?? 0) + Number(attr(tag, "time") || 0);
  }
}

const cypExit = readText(firstFile(cypressRoot, ["cypress-exit-code.txt"]), "N/A").trim();
const cypLog = readText(firstFile(cypressRoot, ["cypress-run.log"]), "No Cypress console log was captured.");
const cypResult = env.CYPRESS_RESULT || "unknown";

const cypressContent = `
  <div class="meta">${meta("Exit Code", cypExit)}${meta("JUnit Files", String(cypressXmlFiles.length))}${meta("Suites", String(cypSuites))}${meta("Triggered By", actor)}</div>
  <div class="cards">
    ${metric("Total Tests", formatNumber(cypTests))}
    ${metric("Failures", formatNumber(cypFailures), cypFailures > 0 ? "bad" : "good")}
    ${metric("Errors", formatNumber(cypErrors), cypErrors > 0 ? "bad" : "good")}
    ${metric("Skipped", formatNumber(cypSkipped))}
    ${metric("Duration", cypTime == null ? "N/A" : `${cypTime.toFixed(2)} s`)}
  </div>
  <details><summary>Execution Console Output</summary><pre>${escapeHtml(cypLog)}</pre></details>
`;

fs.writeFileSync("reports/html/cypress-e2e-report.html", page("Cypress E2E Test Execution", `<span class="badge ${cypResult === "success" ? "success" : "failure"}">${escapeHtml(executionLabel(cypResult))}</span>`, cypressContent, "Cypress metrics read from JUnit XML files."));

// k6 REPORT HELPER
function readK6Summary(root, filename) {
  const file = firstFile(root, [filename]);
  if (!file) return { file: null, raw: `No ${filename} was captured.`, data: null };
  const raw = readText(file);
  try { return { file, raw, data: JSON.parse(raw) }; } catch (error) { return { file, raw, data: null, error: error.message }; }
}

function k6Metrics(summary) {
  const m = summary?.data?.metrics || {};
  return {
    requests: m.http_reqs?.count, requestRate: m.http_reqs?.rate, avg: m.http_req_duration?.avg,
    p95: m.http_req_duration?.["p(95)"], max: m.http_req_duration?.max, failedRate: m.http_req_failed?.value,
    iterations: m.iterations?.count, vus: m.vus?.value, vusMax: m.vus_max?.value ?? m.vus_max?.max,
    checksPassed: m.checks?.passes, checksFailed: m.checks?.fails, checksRate: m.checks?.value
  };
}

function k6Page(title, root, summaryFile, executionResult, profile) {
  const summary = readK6Summary(root, summaryFile);
  const m = k6Metrics(summary);
  const exitCode = readText(firstFile(root, [summaryFile === "summary.json" ? "k6-exit-code.txt" : "smoke-exit-code.txt"]), "N/A").trim();
  const consoleLog = readText(firstFile(root, [summaryFile === "summary.json" ? "k6-console.log" : "smoke-console.log"]), "No k6 console log was captured.");
  
  const content = `
    <div class="meta">${meta("Exit Code", exitCode)}${meta("Requests / sec", m.requestRate == null ? "N/A" : m.requestRate.toFixed(2))}${meta("Max VUs", formatNumber(m.vusMax))}${meta("Load Profile", profile)}</div>
    <div class="cards">
      ${metric("Total Requests", formatNumber(m.requests))}
      ${metric("Avg Latency", formatMs(m.avg))}
      ${metric("P95 Latency", formatMs(m.p95))}
      ${metric("Max Latency", formatMs(m.max))}
      ${metric("HTTP Failed Rate", formatPercent(m.failedRate), Number(m.failedRate) > 0 ? "bad" : "good")}
      ${metric("Iterations", formatNumber(m.iterations))}
      ${metric("Checks Passed", formatNumber(m.checksPassed), "good")}
      ${metric("Checks Failed", formatNumber(m.checksFailed), Number(m.checksFailed) > 0 ? "bad" : "good")}
    </div>
    <details><summary>Raw k6 Summary JSON</summary><pre>${escapeHtml(summary.raw)}</pre></details>
    <details><summary>k6 Console Output</summary><pre>${escapeHtml(consoleLog)}</pre></details>
  `;

  return page(title, `<span class="badge ${executionResult === "success" ? "success" : "failure"}">${escapeHtml(executionLabel(executionResult))}</span>`, content, "k6 values read directly from summary-export JSON.");
}

fs.writeFileSync("reports/html/k6-smoke-report.html", k6Page("k6 Smoke Test Execution", "reports/k6-smoke", "smoke-summary.json", env.K6_SMOKE_RESULT || "unknown", "Smoke profile from tests/load.js"));
fs.writeFileSync("reports/html/k6-load-report.html", k6Page("k6 Load Test Execution", "reports/k6-load", "summary.json", env.K6_LOAD_RESULT || "unknown", "10 VUs / 30 seconds"));
NODE

node generate-qa-report.mjs || true
if [[ -n "${EMAIL_USER:-}" ]]; then
  subject="QA Pipeline Report [${GITHUB_REF_NAME:-main}] - Run #${GITHUB_RUN_NUMBER:-1}"
  body='<p>Hi,</p><p>The QA Pipeline for repository <b>'"${GITHUB_REPOSITORY:-}"'</b> has finished execution.</p><p>Cypress E2E: '"$CYPRESS_RESULT"'</p><p>k6 Smoke Test: '"$K6_SMOKE_RESULT"'</p><p>k6 Load Test: '"$K6_LOAD_RESULT"'</p>'
  send_mail "$subject" "${QA_EMAIL_TO:-}" "${QA_EMAIL_CC:-}" "$body" reports/html/cypress-e2e-report.html reports/html/k6-smoke-report.html reports/html/k6-load-report.html || true
fi