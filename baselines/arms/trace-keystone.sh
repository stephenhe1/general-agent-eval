#!/usr/bin/env bash
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
"$(dirname "$0")/../../general-agent-eval/resources/scripts/run-with-service.sh" keystone-blog \
  --repo /Users/stephenhe/Projects/new-benchmark-repos/keystone/examples/usecase-blog \
  --host 127.0.0.1 --port 3200 -- bash -c '
    # Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
    for arm in A-naive B-pwagents; do
      echo "[keystone][$arm] trace run"
      ( cd "$ROOT/keystone-blog/$arm" && npx playwright test --trace=on --reporter=json > results.json 2>"$ROOT/logs/keystone-$arm-trace.err" )
      echo "[keystone][$arm] exit=$?"
    done
    echo "[keystone] TRACING DONE"
  '
