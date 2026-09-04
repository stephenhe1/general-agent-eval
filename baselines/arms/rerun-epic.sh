#!/usr/bin/env bash
# epic-stack: repair arm B's workspace, then (1) trace arm A for reach scoring and
# (2) run arm B, both against one live instance.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
REPO="/Users/stephenhe/Projects/new-benchmark-repos/epic-stack"
B="$ROOT/epic-stack/B-pwagents"; A="$ROOT/epic-stack/A-naive"; LOGS="$ROOT/logs"

echo "[epic][B] installing deps"
( cd "$B" && rm -f package-lock.json && npm install --no-audit --no-fund ) >"$LOGS/epic-stack-B-npm2.log" 2>&1
if [ ! -d "$B/node_modules/@playwright/test" ]; then
    echo "[epic][B] FATAL: @playwright/test still missing"; exit 2
fi
if [ ! -d "$B/.git" ]; then
    ( cd "$B" && git init -q && git add -A && git -c user.email=b@local -c user.name=baseline commit -qm init )
fi
mkdir -p "$B/.claude"
printf '{\n  "worktree": { "baseRef": "head" }\n}\n' > "$B/.claude/settings.json"
( cd "$B" && npx --yes playwright init-agents --loop=claude ) >"$LOGS/epic-stack-B-init2.log" 2>&1
for f in .claude/agents/playwright-test-planner.md .mcp.json; do
    [ -e "$B/$f" ] || { echo "[epic][B] FATAL: init-agents produced no $f"; exit 3; }
done
echo "[epic][B] agents installed"

"$SCRIPTS/run-with-service.sh" epic-stack --repo "$REPO" --host 127.0.0.1 --port 3000 -- bash -c '
  set -uo pipefail
  # Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"; LOGS="$ROOT/logs"
  EVAL="/Users/stephenhe/Projects/general-agent-eval"
  A="$ROOT/epic-stack/A-naive"; B="$ROOT/epic-stack/B-pwagents"
  echo "[epic][A] tracing the generated suite for reach scoring"
  ( cd "$A" && npx playwright test --trace=on --reporter=json > results.json 2>"$LOGS/epic-stack-A-trace.err" )
  echo "[epic][A] trace run exit=$?"
  echo "[epic][B] playwright agents starting"
  ( cd "$EVAL" && uv run general-agent-eval-claude-code --input-dir "$B" --workload javascript --mode baseline \
      --user-template "$ROOT/epic-stack/driver_prompt.jinja2" --model claude-sonnet-4-6 \
      --prompt-var "service_base_url=http://127.0.0.1:3000" --max-turns 250 \
      --output-jsonl "$LOGS/epic-stack-B2.jsonl" ) >"$LOGS/epic-stack-B2.log" 2>&1
  echo "[epic][B] exit=$? specs=$(find "$B/tests" -name "*.spec.ts" -not -name "seed.spec.ts" 2>/dev/null | wc -l | tr -d " ")"
  echo "[epic-stack] DONE"
'
echo "[epic] wrapper exit=$?"
