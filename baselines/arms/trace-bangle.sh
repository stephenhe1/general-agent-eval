#!/usr/bin/env bash
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
REPO="/Users/stephenhe/Projects/new-benchmark-repos/bangle-io"
for arm in A-naive B-pwagents; do
    rm -rf "$ROOT/bangle-io/$arm/test-results" "$ROOT/bangle-io/$arm/results.json"
    "$SCRIPTS/run-with-service.sh" bangle-io --repo "$REPO" --host 127.0.0.1 --port 5173 -- bash -c "
        cd '$ROOT/bangle-io/$arm' && npx playwright test --trace=on --reporter=json > results.json 2>'$ROOT/logs/bangle-$arm-trace.err'
        echo \"[bangle][$arm] trace exit=\$?\"
    "
done
echo "BANGLE TRACING DONE"
