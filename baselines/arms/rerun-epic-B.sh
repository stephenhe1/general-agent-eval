#!/usr/bin/env bash
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
"$SCRIPTS/run-with-service.sh" epic-stack --repo /Users/stephenhe/Projects/new-benchmark-repos/epic-stack \
  --host 127.0.0.1 --port 3000 -- bash -c '
    # Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"; LOGS="$ROOT/logs"
    B="$ROOT/epic-stack/B-pwagents"
    ( cd /Users/stephenhe/Projects/general-agent-eval && uv run general-agent-eval-claude-code \
        --input-dir "$B" --workload javascript --mode baseline \
        --user-template "$ROOT/epic-stack/driver_prompt.jinja2" --model claude-sonnet-4-6 \
        --prompt-var "service_base_url=http://127.0.0.1:3000" --max-turns 250 \
        --output-jsonl "$LOGS/epic-stack-B3.jsonl" ) >"$LOGS/epic-stack-B3.log" 2>&1
    echo "[epic][B] exit=$? specs=$(find "$B/tests" -name "*.spec.ts" -not -name seed.spec.ts | wc -l | tr -d " ")"
  '
