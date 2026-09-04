#!/usr/bin/env bash
# Trace one A1 workspace against its live app, with the same state reset the other arms got.
set -uo pipefail
s="$1"
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
NB="/Users/stephenhe/Projects/new-benchmark-repos"
src=$(awk -F'\t' -v s="$s" '$1==s{print $2}' "$ROOT/a1-subjects.tsv")
port=$(awk -F'\t' -v s="$s" '$1==s{print $3}' "$ROOT/a1-subjects.tsv")
case "$s" in
  keystone-blog) cp "$NB/keystone/examples/usecase-blog/keystone-example.pristine.db" "$NB/keystone/examples/usecase-blog/keystone-example.db" ;;
  epic-stack)    cp "$NB/epic-stack/prisma/pristine.db" "$NB/epic-stack/prisma/data.db" ;;
  cypress-realworld-app) cp "$NB/cypress-realworld-app/data/database-seed.json" "$NB/cypress-realworld-app/data/database.json"
                 ( cd "$NB/cypress-realworld-app" && yarn start:api ) >"$ROOT/logs/A1t-rwa-api.log" 2>&1 &
                 echo $! > "$ROOT/logs/A1t-rwa-api.pid"; sleep 20 ;;
esac
rm -rf "$ROOT/$s/A1-repo/test-results" "$ROOT/$s/A1-repo/results.json"
"$SCRIPTS/run-with-service.sh" "$s" --repo "$src" --host 127.0.0.1 --port "$port" -- bash -c "
  cd '$ROOT/$s/A1-repo'
  npx playwright test --workers=1 --trace=on --reporter=json > results.json 2>'$ROOT/logs/A1-$s-trace.err'
  echo \"[$s][A1] trace exit=\$?\"
"
if [ "$s" = cypress-realworld-app ] && [ -f "$ROOT/logs/A1t-rwa-api.pid" ]; then
  kill "$(cat "$ROOT/logs/A1t-rwa-api.pid")" 2>/dev/null; rm -f "$ROOT/logs/A1t-rwa-api.pid"
fi
echo "[$s][A1] TRACE DONE"
