#!/usr/bin/env bash
# scripts/audit-invoke.sh
#
# Audit the invoke() ↔ generate_handler!{} round-trip.
#
# Frontend invokes are extracted from src/ via `invoke('NAME' | "NAME")`
# and `tauri.core.invoke('NAME' | "NAME")` patterns.
# Backend handlers are extracted from the `tauri::generate_handler![ ... ]`
# block in src-tauri/src/lib.rs.
#
# A non-empty diff is a 0-tolerance failure: any invoke() called from JS
# without a matching handler in lib.rs will throw "command not implemented"
# at runtime.
#
# Usage:
#   ./scripts/audit-invoke.sh                 # show diff, exit 0 if empty, 1 if not
#   ./scripts/audit-invoke.sh --baseline      # write baseline-diff.txt
#   ./scripts/audit-invoke.sh --json          # emit JSON
#
# Exits 0 when diff is empty, 1 when missing handlers exist, 2 on usage error.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FRONTEND_DIR="$ROOT_DIR/src"
BACKEND_FILE="$ROOT_DIR/src-tauri/src/lib.rs"
BASELINE_FILE="$ROOT_DIR/scripts/audit-invoke-baseline.txt"

MODE="check"
case "${1:-}" in
  "") MODE="check" ;;
  --baseline) MODE="baseline" ;;
  --json) MODE="json" ;;
  --help|-h)
    sed -n '2,28p' "$0"
    exit 0
    ;;
  *)
    echo "Usage: $0 [--baseline|--json|--help]" >&2
    exit 2
    ;;
esac

TMPDIR_OUT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_OUT"' EXIT

# --- Frontend invoke names -------------------------------------------------
# Pattern covers: invoke('NAME'[, ...]) and tauri.core.invoke('NAME'[, ...])
FRONTEND_RAW="$TMPDIR_OUT/frontend-raw.txt"
grep -RhnE "(^|[^A-Za-z0-9_])(invoke|tauri\.core\.invoke)\(['\"][a-z_][a-z0-9_]*['\"]" \
  "$FRONTEND_DIR" 2>/dev/null > "$FRONTEND_RAW" || true

# Strip everything before the quote and keep only the name.
FRONTEND_NAMES="$TMPDIR_OUT/frontend-names.txt"
sed -E "s/.*(invoke|tauri\.core\.invoke)\(['\"]([a-z_][a-z0-9_]*)['\"].*/\2/" "$FRONTEND_RAW" \
  | sort -u > "$FRONTEND_NAMES"

# --- Backend registered handler names -------------------------------------
# Match lines inside the generate_handler![ ... ] block: a leading comma or
# opening bracket, then whitespace and the handler name, then a comma or
# closing bracket.
HANDLER_BLOCK="$TMPDIR_OUT/handler-block.txt"
awk '
  /tauri::generate_handler!\[/  { in_block=1; next }
  in_block && /\]/              { in_block=0; next }
  in_block                      { print }
' "$BACKEND_FILE" > "$HANDLER_BLOCK"

BACKEND_NAMES="$TMPDIR_OUT/backend-names.txt"
sed -nE 's/^[[:space:]]*([a-z_][a-z0-9_]*),?[[:space:]]*$/\1/p' "$HANDLER_BLOCK" \
  | sort -u > "$BACKEND_NAMES"

# --- Compute the round-trip diff -------------------------------------------
# Frontend calls that have no matching backend handler.
MISSING="$TMPDIR_OUT/missing.txt"
comm -23 "$FRONTEND_NAMES" "$BACKEND_NAMES" > "$MISSING"

# --- Cross-reference: backend handlers no frontend uses (informational) ---
UNUSED="$TMPDIR_OUT/unused.txt"
comm -13 "$FRONTEND_NAMES" "$BACKEND_NAMES" > "$UNUSED"

MISSING_COUNT=$(wc -l < "$MISSING" | tr -d ' ')
FRONTEND_COUNT=$(wc -l < "$FRONTEND_NAMES" | tr -d ' ')
BACKEND_COUNT=$(wc -l < "$BACKEND_NAMES" | tr -d ' ')

# --- Output ----------------------------------------------------------------
case "$MODE" in
  baseline)
    {
      echo "# audit-invoke.sh baseline"
      echo "# Date: $(date -Iseconds)"
      echo "# Commit: $(cd "$ROOT_DIR" && git rev-parse HEAD 2>/dev/null || echo unknown)"
      echo "# Frontend invokes: $FRONTEND_COUNT"
      echo "# Backend handlers: $BACKEND_COUNT"
      echo "# Missing (frontend calls without backend handler): $MISSING_COUNT"
      echo
      if [ "$MISSING_COUNT" -gt 0 ]; then
        echo "## MISSING HANDLERS (must be 0 for release)"
        cat "$MISSING"
      else
        echo "## MISSING HANDLERS: none"
      fi
    } > "$BASELINE_FILE"
    echo "Baseline written to $BASELINE_FILE"
    if [ "$MISSING_COUNT" -gt 0 ]; then
      echo "STATUS: FAIL ($MISSING_COUNT missing handlers)" >&2
      exit 1
    fi
    exit 0
    ;;

  json)
    MISSING_JSON="[]"
    if [ "$MISSING_COUNT" -gt 0 ]; then
      MISSING_JSON=$(jq -R . < "$MISSING" | jq -s .)
    fi
    UNUSED_JSON="[]"
    if [ -s "$UNUSED" ]; then
      UNUSED_JSON=$(jq -R . < "$UNUSED" | jq -s .)
    fi
    printf '{"frontend":%d,"backend":%d,"missing":%d,"missing_handlers":%s,"unused_handlers":%s}\n' \
      "$FRONTEND_COUNT" "$BACKEND_COUNT" "$MISSING_COUNT" "$MISSING_JSON" "$UNUSED_JSON"
    if [ "$MISSING_COUNT" -gt 0 ]; then
      exit 1
    fi
    exit 0
    ;;

  check|*)
    echo "=== invoke audit ==="
    echo "Frontend invoke() calls:    $FRONTEND_COUNT"
    echo "Backend registered handlers: $BACKEND_COUNT"
    echo
    if [ "$MISSING_COUNT" -gt 0 ]; then
      echo "MISSING handlers (frontend calls without backend registration):"
      sed 's/^/  - /' "$MISSING"
      echo
      echo "STATUS: FAIL — any of these in the UI will throw 'command not implemented' at runtime."
      exit 1
    fi
    echo "STATUS: OK — every frontend invoke() has a matching backend handler."
    if [ -s "$UNUSED" ]; then
      echo
      echo "Note: the following backend handlers have no frontend caller (informational, not a failure):"
      sed 's/^/  - /' "$UNUSED"
    fi
    exit 0
    ;;
esac
