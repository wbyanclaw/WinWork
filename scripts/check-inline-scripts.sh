#!/usr/bin/env bash
# scripts/check-inline-scripts.sh
#
# Run `node --check` against every inline <script> block in src/index.html.
#
# Why: the v0.2.27 regression — 4 backslash-escaped backticks broke template
# literals and bricked the whole UI. `npm test` (4 runtime tests) never
# touches index.html. Without this gate, the next release can ship a
# SyntaxError and we won't know until Windows users open it.
#
# Usage:
#   ./scripts/check-inline-scripts.sh             # show OK/FAIL per block, exit 0/1
#   ./scripts/check-inline-scripts.sh --json      # emit JSON for CI

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$ROOT_DIR/src/index.html"

MODE="check"
case "${1:-}" in
  "") MODE="check" ;;
  --json) MODE="json" ;;
  --help|-h)
    sed -n '2,20p' "$0"
    exit 0
    ;;
  *)
    echo "Usage: $0 [--json|--help]" >&2
    exit 2
    ;;
esac

if [ ! -f "$TARGET" ]; then
  echo "ERROR: $TARGET not found" >&2
  exit 2
fi

TMPDIR_OUT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_OUT"' EXIT

# Extract inline <script>...</script> blocks (no src= attribute).
BLOCK_FILES=()
python3 - "$TARGET" "$TMPDIR_OUT" <<'PYEOF'
import re, sys
src_path, out_dir = sys.argv[1], sys.argv[2]
with open(src_path, 'r', encoding='utf-8') as f:
    html = f.read()
pattern = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL)
blocks = pattern.findall(html)
nonempty = [b for b in blocks if b.strip()]
for i, content in enumerate(nonempty, 1):
    out = f"{out_dir}/block-{i}.mjs"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
print(f"{len(nonempty)}")
PYEOF
BLOCK_COUNT="$(python3 -c "import re,sys;src=open('$TARGET').read();print(len([b for b in re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>(.*?)</script>', src, re.DOTALL) if b.strip()]))")"

FAILED=0
FAIL_LIST=()

for ((i=1; i<=BLOCK_COUNT; i++)); do
  block="$TMPDIR_OUT/block-$i.mjs"
  [ -f "$block" ] || continue
  size=$(wc -c < "$block" | tr -d ' ')
  if node --check "$block" >/dev/null 2>"$TMPDIR_OUT/err-$i.txt"; then
    if [ "$MODE" = "check" ]; then
      printf "  ✅ block %d (%s bytes)\n" "$i" "$size"
    fi
  else
    FAILED=$((FAILED+1))
    FAIL_LIST+=("$i")
    if [ "$MODE" = "check" ]; then
      printf "  ❌ block %d (%s bytes): %s\n" "$i" "$size" "$(head -c 200 "$TMPDIR_OUT/err-$i.txt" | tr '\n' ' ')"
    fi
  fi
done

case "$MODE" in
  json)
    if [ "$FAILED" -gt 0 ]; then
      printf '{"blocks":%d,"failed":%d,"failed_indices":[%s]}\n' \
        "$BLOCK_COUNT" "$FAILED" "$(IFS=,; echo "${FAIL_LIST[*]}")"
    else
      printf '{"blocks":%d,"failed":0,"failed_indices":[]}\n' "$BLOCK_COUNT"
    fi
    ;;
  *)
    echo
    if [ "$FAILED" -gt 0 ]; then
      echo "STATUS: FAIL — $FAILED/$BLOCK_COUNT inline <script> block(s) have syntax errors."
      exit 1
    fi
    echo "STATUS: OK — all $BLOCK_COUNT inline <script> block(s) pass node --check."
    ;;
esac

[ "$FAILED" -eq 0 ]
