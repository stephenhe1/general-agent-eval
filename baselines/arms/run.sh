#!/usr/bin/env bash
# Launch both baselines on all five subjects, one background job per subject.
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
SCRIPTS="/Users/stephenhe/Projects/general-agent-eval/resources/scripts"
LOGS="$ROOT/logs"

while IFS=$'\t' read -r SUBJECT SVC REPO PORT LOGIN; do
    [ -z "${SUBJECT:-}" ] && continue
    (
        URL="http://127.0.0.1:$PORT"
        python3 "$ROOT/scaffold.py" "$SUBJECT" "$URL" "$ROOT" 2>&1

        # RWA needs its API backend as well as the frontend.
        if [ "$LOGIN" = "rwa" ]; then
            echo "[$SUBJECT] starting API backend on :3001"
            ( cd "$REPO" && yarn start:api ) >"$LOGS/$SUBJECT-api.log" 2>&1 &
            echo $! > "$LOGS/$SUBJECT-api.pid"
            sleep 20
        fi

        "$SCRIPTS/run-with-service.sh" "$SVC" --repo "$REPO" --host 127.0.0.1 --port "$PORT" \
            -- bash "$ROOT/arms.sh" "$SUBJECT" "$URL"
        STATUS=$?
        echo "[$SUBJECT] service wrapper exit=$STATUS"

        if [ -f "$LOGS/$SUBJECT-api.pid" ]; then
            kill "$(cat "$LOGS/$SUBJECT-api.pid")" 2>/dev/null
            rm -f "$LOGS/$SUBJECT-api.pid"
        fi
    ) >"$LOGS/$SUBJECT-driver.log" 2>&1 &
done < "$ROOT/subjects.tsv"

wait
echo "ALL SUBJECTS DONE"
