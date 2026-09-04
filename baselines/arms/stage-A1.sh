#!/usr/bin/env bash
set -uo pipefail
# Workspace root: where the per-subject arm workspaces and traces live. These are
# large, machine-local artifacts and are deliberately NOT in this repository.
ROOT="${BASELINE_ROOT:-/Users/stephenhe/Projects/baseline-runs/20260901}"
while IFS=$'\t' read -r s src port; do
  [ -z "${s:-}" ] && continue
  dst="$ROOT/$s/A1-repo"
  echo "=== $s: staging from $src"
  rm -rf "$dst"; mkdir -p "$dst"
  rsync -a --exclude node_modules --exclude .git --exclude dist --exclude build \
        --exclude .next --exclude .cache --exclude coverage --exclude playwright-report \
        --exclude test-results --exclude '*.db' --exclude '*.db-*' "$src/" "$dst/"
  du -sh "$dst" | sed 's/^/    size: /'
  PYTHONPATH=/Users/stephenhe/Projects/general-agent-eval/src python3 - "$dst" "$ROOT/logs/clearing-$s.json" <<'PY'
import json, sys
from general_agent_eval.preprocessing.js_test_clearing import clear_js_tests
d = clear_js_tests(sys.argv[1]).to_dict()
open(sys.argv[2], "w").write(json.dumps(d, indent=1))
print(f"    cleared {d['removed_count']} test path(s); preserved-suspicious {d['preserved_suspicious_count']}")
for item in d["removed"][:5]:
    print(f"      - {item['path']}  ({item['rule']})")
PY
  cp "$ROOT/$s/A-naive/APP_NOTES.md" "$dst/APP_NOTES.md" 2>/dev/null || true
  ( cd "$dst" && npm i --no-save --no-audit --no-fund @playwright/test ) > "$ROOT/logs/A1-$s-npm.log" 2>&1
  if [ -d "$dst/node_modules/@playwright/test" ]; then echo "    @playwright/test ready"; else echo "    WARNING @playwright/test missing"; fi
  left=$(find "$dst" -path "$dst/node_modules" -prune -o \( -name '*.spec.*' -o -name '*.test.*' -o -name '*.cy.*' \) -print 2>/dev/null | wc -l | tr -d ' ')
  echo "    residual test files: $left"
done < "$ROOT/a1-subjects.tsv"
echo "STAGING DONE"
