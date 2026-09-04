#!/usr/bin/env bash
# keystone-blog only: the example lives inside the monorepo, so the service must be
# started from examples/usecase-blog where `npx keystone` resolves.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
REPO="/Users/stephenhe/Projects/new-benchmark-repos/keystone/examples/usecase-blog"
URL="http://127.0.0.1:3200"
python3 "$ROOT/scaffold.py" keystone-blog "$URL" "$ROOT"
"$SCRIPTS/run-with-service.sh" keystone-blog --repo "$REPO" --host 127.0.0.1 --port 3200 \
    -- bash "$ROOT/arms.sh" keystone-blog "$URL"
echo "[keystone-blog] service wrapper exit=$?"
