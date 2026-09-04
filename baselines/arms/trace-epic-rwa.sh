#!/usr/bin/env bash
# Trace epic-stack and cypress-realworld-app, one arm per service lifetime, state reset before each.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
EPIC="/Users/stephenhe/Projects/new-benchmark-repos/epic-stack"
RWA="/Users/stephenhe/Projects/new-benchmark-repos/cypress-realworld-app"

for arm in A-naive B-pwagents; do
    echo "[epic][$arm] restoring pristine db"
    cp "$EPIC/prisma/pristine.db" "$EPIC/prisma/data.db"
    rm -f "$EPIC/prisma/data.db-shm" "$EPIC/prisma/data.db-wal"
    rm -rf "$ROOT/epic-stack/$arm/test-results" "$ROOT/epic-stack/$arm/results.json"
    "$SCRIPTS/run-with-service.sh" epic-stack --repo "$EPIC" --host 127.0.0.1 --port 3000 -- bash -c "
        cd '$ROOT/epic-stack/$arm' && npx playwright test --trace=on --reporter=json > results.json 2>'$ROOT/logs/epic-$arm-trace.err'
        echo \"[epic][$arm] trace exit=\$?\"
    "
done
cp "$EPIC/prisma/pristine.db" "$EPIC/prisma/data.db"

for arm in A-naive B-pwagents; do
    echo "[rwa][$arm] restoring seed data"
    cp "$RWA/data/database-seed.json" "$RWA/data/database.json"
    rm -rf "$ROOT/cypress-realworld-app/$arm/test-results" "$ROOT/cypress-realworld-app/$arm/results.json"
    ( cd "$RWA" && yarn start:api ) >"$ROOT/logs/rwa-api-$arm.log" 2>&1 &
    API=$!
    sleep 20
    "$SCRIPTS/run-with-service.sh" cypress-realworld-app --repo "$RWA" --host 127.0.0.1 --port 5182 -- bash -c "
        cd '$ROOT/cypress-realworld-app/$arm' && npx playwright test --trace=on --reporter=json > results.json 2>'$ROOT/logs/rwa-$arm-trace.err'
        echo \"[rwa][$arm] trace exit=\$?\"
    "
    kill $API 2>/dev/null
done
cp "$RWA/data/database-seed.json" "$RWA/data/database.json"
echo "EPIC+RWA TRACING DONE"
