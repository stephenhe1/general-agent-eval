#!/usr/bin/env bash
# A1: the harness's intended naive baseline -- repo-informed, existing UI tests cleared.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
EVAL="/Users/stephenhe/Projects/general-agent-eval"
NB="/Users/stephenhe/Projects/new-benchmark-repos"

while IFS=$'\t' read -r s src port; do
  [ -z "${s:-}" ] && continue
  (
    URL="http://127.0.0.1:$port"
    A1="$ROOT/$s/A1-repo"
    # Same state resets the traced runs used, so A1 starts where A0 and B started.
    case "$s" in
      keystone-blog) cp "$NB/keystone/examples/usecase-blog/keystone-example.pristine.db" \
                        "$NB/keystone/examples/usecase-blog/keystone-example.db" ;;
      epic-stack)    cp "$NB/epic-stack/prisma/pristine.db" "$NB/epic-stack/prisma/data.db" ;;
      cypress-realworld-app) cp "$NB/cypress-realworld-app/data/database-seed.json" \
                                "$NB/cypress-realworld-app/data/database.json"
                     ( cd "$NB/cypress-realworld-app" && yarn start:api ) >"$ROOT/logs/A1-rwa-api.log" 2>&1 &
                     echo $! > "$ROOT/logs/A1-rwa-api.pid"; sleep 20 ;;
    esac

    SERVICE_REPO="$src"
    "$SCRIPTS/run-with-service.sh" "$s" --repo "$SERVICE_REPO" --host 127.0.0.1 --port "$port" -- bash -c "
      echo '[$s][A1] starting repo-informed baseline (tests already cleared)'
      cd '$EVAL' && uv run general-agent-eval-claude-code \
        --input-dir '$A1' \
        --workload javascript \
        --mode baseline \
        --clear-tests \
        --model claude-sonnet-4-6 \
        --prompt-var 'service_base_url=$URL' \
        --max-turns 200 \
        --output-jsonl '$ROOT/logs/$s-A1.jsonl' > '$ROOT/logs/$s-A1.log' 2>&1
      echo \"[$s][A1] exit=\$? specs=\$(find '$A1' -name '*.spec.ts' -not -path '*/node_modules/*' | wc -l | tr -d ' ')\"
    "
    if [ -f "$ROOT/logs/A1-rwa-api.pid" ] && [ "$s" = cypress-realworld-app ]; then
      kill "$(cat "$ROOT/logs/A1-rwa-api.pid")" 2>/dev/null; rm -f "$ROOT/logs/A1-rwa-api.pid"
    fi
    echo "[$s][A1] wrapper exit=$?"
  ) >"$ROOT/logs/$s-A1-driver.log" 2>&1 &
done < "$ROOT/a1-subjects.tsv"
wait
echo "ALL A1 RUNS DONE"
