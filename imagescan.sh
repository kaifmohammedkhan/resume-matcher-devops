#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
IMAGE_NAME="resume-matcher-devops-web:latest"
RAW_JSON="raw-scan.json"
FINAL_REPORT="scan-results.json"

echo "--- 1. Environment Cleanup ---"
docker system prune -a -f
rm -f "$RAW_JSON" "$FINAL_REPORT"

echo "--- 2. Resetting Node Environment & Cache ---"
rm -rf node_modules package-lock.json
npm cache clean --force

echo "--- 3. Installing & Patching Dependencies ---"
npm install
# Attempt to fix known vulnerabilities in package.json
echo "--- Running npm audit fix ---"
npm audit fix || true  # Continue even if some issues remain
npm audit fix --force || true 

echo "--- 4. Building Docker Images ---"
# Build with no-cache to ensure OS-level patches are pulled
docker-compose build --no-cache --pull

echo "--- 5. Running Security Scan ---"
trivy clean --all
# Generate raw JSON data
trivy image --severity HIGH,CRITICAL --format json --output "$RAW_JSON" "$IMAGE_NAME"

echo "--- 6. Filtering Results into $FINAL_REPORT ---"
node -e "
const fs = require('fs');
try {
    const raw = JSON.parse(fs.readFileSync('$RAW_JSON', 'utf8'));
    const filtered = (raw.Results || []).flatMap(r => (r.Vulnerabilities || []).map(v => ({
        Title: v.Title || 'No Title',
        Description: v.Description || 'No Description',
        Severity: v.Severity,
        CweIDs: v.CweIDs || [],
        PrimaryURL: v.PrimaryURL || ''
    })));
    fs.writeFileSync('$FINAL_REPORT', JSON.stringify(filtered, null, 2));
    console.log('Successfully filtered ' + filtered.length + ' vulnerabilities.');
} catch (err) {
    console.error('JSON Processing Error:', err.message);
    process.exit(1);
}
"

rm -f "$RAW_JSON"
echo "--- Pipeline completed successfully ---"