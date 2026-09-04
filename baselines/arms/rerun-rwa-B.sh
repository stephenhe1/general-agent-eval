#!/usr/bin/env bash
# Re-run arm B only for cypress-realworld-app, after the worktree fix.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
REPO="/Users/stephenhe/Projects/new-benchmark-repos/cypress-realworld-app"
B="$ROOT/cypress-realworld-app/B-pwagents"
rm -rf "$B/specs" "$B/tests"/*.spec.ts.bak 2>/dev/null
( cd "$REPO" && yarn start:api ) >"$ROOT/logs/rwa-api-rerun.log" 2>&1 &
echo $! > "$ROOT/logs/rwa-api-rerun.pid"
sleep 20
ARMS_ONLY=B "$SCRIPTS/run-with-service.sh" cypress-realworld-app --repo "$REPO" --host 127.0.0.1 --port 5182 \
    -- bash -c '
      set -uo pipefail
      # Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"; B="$ROOT/cypress-realworld-app/B-pwagents"
      EVAL="/Users/stephenhe/Projects/general-agent-eval"; LOGS="$ROOT/logs"
      if [ ! -d "$B/.git" ]; then ( cd "$B" && git init -q && git add -A && git -c user.email=b@local -c user.name=baseline commit -qm init ); fi
      mkdir -p "$B/.claude"; printf "{\n  \"worktree\": { \"baseRef\": \"head\" }\n}\n" > "$B/.claude/settings.json"
      echo "[rwa][B] retry starting"
      ( cd "$EVAL" && uv run general-agent-eval-claude-code --input-dir "$B" --workload javascript --mode baseline \
          --user-template "$ROOT/cypress-realworld-app/driver_prompt.jinja2" --model claude-sonnet-4-6 \
          --prompt-var "service_base_url=http://127.0.0.1:5182" --max-turns 250 \
          --output-jsonl "$LOGS/cypress-realworld-app-B2.jsonl" ) >"$LOGS/cypress-realworld-app-B2.log" 2>&1
      echo "[rwa][B] retry exit=$? specs=$(find "$B/tests" -name "*.spec.ts" -not -name "seed.spec.ts" | wc -l | tr -d " ")"
    '
kill "$(cat "$ROOT/logs/rwa-api-rerun.pid")" 2>/dev/null; rm -f "$ROOT/logs/rwa-api-rerun.pid"
echo "[rwa][B] rerun wrapper exit=$?"
