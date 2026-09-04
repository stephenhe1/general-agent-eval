#!/usr/bin/env bash
# Trace each keystone arm from the SAME pristine database, one arm per service lifetime.
# Without this, arm B inherits whatever arm A's suite left behind and its own tests start
# failing on unique constraints -- measured: 10 excluded failures and a false 0 on create.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
EX="/Users/stephenhe/Projects/new-benchmark-repos/keystone/examples/usecase-blog"

for arm in A-naive B-pwagents; do
    echo "[keystone][$arm] restoring pristine db"
    cp "$EX/keystone-example.pristine.db" "$EX/keystone-example.db"
    rm -f "$EX/keystone-example.db-shm" "$EX/keystone-example.db-wal"
    rm -rf "$ROOT/keystone-blog/$arm/test-results" "$ROOT/keystone-blog/$arm/results.json"
    "$SCRIPTS/run-with-service.sh" keystone-blog --repo "$EX" --host 127.0.0.1 --port 3200 -- bash -c "
        cd '$ROOT/keystone-blog/$arm'
        npx playwright test --trace=on --reporter=json > results.json 2>'$ROOT/logs/keystone-$arm-trace2.err'
        echo \"[keystone][$arm] trace exit=\$?\"
    "
    echo "[keystone][$arm] service exit=$?"
done
cp "$EX/keystone-example.pristine.db" "$EX/keystone-example.db"
echo "[keystone] PRISTINE TRACING DONE"
