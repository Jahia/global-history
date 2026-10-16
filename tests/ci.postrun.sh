#!/usr/bin/env bash

# This script is executed after the run
source ./set-env.sh

# Jahia integration-tests reporter expects tests/artifacts/results/reports/report.json
mkdir -p artifacts/results/reports

if compgen -G "artifacts/results/reports/cypress_*.json" >/dev/null; then
    yarn --silent mochawesome-merge artifacts/results/reports/cypress_*.json > artifacts/results/reports/report.json
elif compgen -G "results/reports/cypress_*.json" >/dev/null; then
    yarn --silent mochawesome-merge results/reports/cypress_*.json > artifacts/results/reports/report.json
elif [[ -f "results/reports/report.json" ]]; then
    cp results/reports/report.json artifacts/results/reports/report.json
elif [[ -f "artifacts/results/reports/report.json" ]]; then
    echo "report.json already present in artifacts/results/reports"
else
    echo "No Cypress report inputs found for merge. Creating empty report.json fallback." >&2
    cat > artifacts/results/reports/report.json <<'EOF'
{"stats":{"suites":0,"tests":0,"passes":0,"pending":0,"failures":0,"start":null,"end":null,"duration":0,"testsRegistered":0,"passPercent":0,"pendingPercent":0,"other":0,"hasOther":false,"skipped":0,"hasSkipped":false},"results":[],"meta":{"mocha":{"version":"0.0.0"},"marge":{"options":{}}}}
EOF
fi
