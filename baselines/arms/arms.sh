#!/usr/bin/env bash
# Run both baselines for one subject against an already-running app.
#   arms.sh <subject> <base_url>
# Arm A: general agent harness, naive mode  (--workload javascript --mode baseline)
# Arm B: Playwright's own test agents       (planner -> generator -> healer)
set -uo pipefail
SUBJECT="$1"; BASE_URL="$2"
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
EVAL="/Users/stephenhe/Projects/general-agent-eval"
LOGS="$ROOT/logs"
MODEL="${MODEL:-claude-sonnet-4-6}"

echo "[$SUBJECT] app is up at $BASE_URL"

# ---------------------------------------------------------------- arm A
A="$ROOT/$SUBJECT/A-naive"
echo "[$SUBJECT][A] npm install"
( cd "$A" && npm install --no-audit --no-fund ) >"$LOGS/$SUBJECT-A-npm.log" 2>&1
echo "[$SUBJECT][A] naive baseline starting (max-turns ${A_TURNS:-200})"
( cd "$EVAL" && uv run general-agent-eval-claude-code \
    --input-dir "$A" \
    --workload javascript \
    --mode baseline \
    --model "$MODEL" \
    --prompt-var "service_base_url=$BASE_URL" \
    --max-turns "${A_TURNS:-200}" \
    --output-jsonl "$LOGS/$SUBJECT-A.jsonl" ) >"$LOGS/$SUBJECT-A.log" 2>&1
echo "[$SUBJECT][A] exit=$? specs=$(find "$A" -name '*.spec.ts' -not -path '*/node_modules/*' | wc -l | tr -d ' ')"

# ---------------------------------------------------------------- arm B
B="$ROOT/$SUBJECT/B-pwagents"
# The Playwright agents run as subagents, and subagent isolation wants a git worktree.
# An untracked directory makes that fail, and a driver session can burn its whole budget
# fixing the config instead of generating tests (measured on cypress-realworld-app).
if [ ! -d "$B/.git" ]; then
    ( cd "$B" && git init -q && git add -A && git -c user.email=b@local -c user.name=baseline commit -qm init ) || true
fi
mkdir -p "$B/.claude"
printf '{\n  "worktree": { "baseRef": "head" }\n}\n' > "$B/.claude/settings.json"
echo "[$SUBJECT][B] npm install + init-agents"
( cd "$B" && npm install --no-audit --no-fund ) >"$LOGS/$SUBJECT-B-npm.log" 2>&1
( cd "$B" && npx --yes playwright init-agents --loop=claude ) >"$LOGS/$SUBJECT-B-init.log" 2>&1
INIT_OK=1
for f in .claude/agents/playwright-test-planner.md .claude/agents/playwright-test-generator.md \
         .claude/agents/playwright-test-healer.md .mcp.json; do
    [ -e "$B/$f" ] || { echo "[$SUBJECT][B] MISSING $f"; INIT_OK=0; }
done
if [ "$INIT_OK" = 0 ]; then
    echo "[$SUBJECT][B] init-agents incomplete -- arm B skipped, see $LOGS/$SUBJECT-B-init.log"
else
    # Same driver prompt the published playwright-agents arm uses, with this app's title/url.
    python3 - "$SUBJECT" "$BASE_URL" "$ROOT/$SUBJECT/driver_prompt.jinja2" <<'PY'
import sys
sys.path.insert(0, "/Users/stephenhe/Projects/general-agent-eval/src")
from general_agent_eval.webtestpilot.playwright_agents import DRIVER_PROMPT
subject, base_url, out = sys.argv[1], sys.argv[2], sys.argv[3]
title = {"todomvc": "TodoMVC", "keystone-blog": "Keystone blog", "bangle-io": "Bangle.io",
         "epic-stack": "Epic Stack", "cypress-realworld-app": "Cypress Real World App"}[subject]
open(out, "w").write(DRIVER_PROMPT.format(app_title=title, base_url=base_url))
print(f"[{subject}][B] driver prompt written")
PY
    echo "[$SUBJECT][B] playwright agents starting (max-turns ${B_TURNS:-250})"
    ( cd "$EVAL" && uv run general-agent-eval-claude-code \
        --input-dir "$B" \
        --workload javascript \
        --mode baseline \
        --user-template "$ROOT/$SUBJECT/driver_prompt.jinja2" \
        --model "$MODEL" \
        --prompt-var "service_base_url=$BASE_URL" \
        --max-turns "${B_TURNS:-250}" \
        --output-jsonl "$LOGS/$SUBJECT-B.jsonl" ) >"$LOGS/$SUBJECT-B.log" 2>&1
    echo "[$SUBJECT][B] exit=$? specs=$(find "$B/tests" -name '*.spec.ts' -not -name 'seed.spec.ts' 2>/dev/null | wc -l | tr -d ' ')"
fi
echo "[$SUBJECT] DONE"
