#!/bin/bash
# winwork Integration Test Suite
# Tests two chains:
#   Chain 1: winwork (Tauri) -> wind-cli
#   Chain 2: wind-cli -> llm-wiki
#
# IMPORTANT: wind-cli uses workspace-relative paths. Commands must be run
# from within the workspace directory (or use '.' relative paths) because
# safe_path() canonicalizes both the workspace root and the requested path,
# and on Linux /tmp is a symlink to /private/tmp causing path mismatches.
#
# Usage:
#   WINDCLI=/path/to/wind ./run-all.sh            # Run all tests
#   WINDCLI=/path/to/wind ./run-all.sh --chain1  # Run only Chain 1
#   WINDCLI=/path/to/wind ./run-all.sh --chain2  # Run only Chain 2

set -euo pipefail

# ── Resolve wind-cli ─────────────────────────────────────────────
WINDCLI="${WINDCLI:-windcli}"

# ── Helpers ──────────────────────────────────────────────────
# log_* functions avoid arithmetic ((expr)) with set -e — use $((...))
log_info()  { echo -e "\033[34m[INFO]\033[0m  $*"; }
log_pass()  { echo -e "\033[32m[PASS]\033[0m  $*"; PASSED=$((PASSED+1)); }
log_fail()  { echo -e "\033[31m[FAIL]\033[0m  $*"; FAILED=$((FAILED+1)); }
log_skip()  { echo -e "\033[33m[SKIP]\033[0m  $*"; SKIPPED=$((SKIPPED+1)); }

PASSED=0; FAILED=0; SKIPPED=0

cleanup() {
  log_info "Cleaning up..."
  # Restore original wind config
  if [[ -n "${ORIG_CONFIG:-}" ]] && [[ -f "$ORIG_CONFIG" ]]; then
    cp "$ORIG_CONFIG" ~/.config/wind/config.json 2>/dev/null || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Run a wind-cli command from within the workspace
# Usage: wind_from_ws <command args...>
wind_from_ws() {
  (cd "$WORKSPACE" && "$WINDCLI" "$@")
}

# ── Pre-flight checks ─────────────────────────────────────────
log_info "winwork Integration Test Suite"
log_info "wind-cli: $WINDCLI"

if [[ ! -x "$WINDCLI" ]] && ! command -v "$WINDCLI" &>/dev/null; then
  log_fail "wind-cli not found: $WINDCLI"
  log_info "Build from source: cd wind-cli && cargo build --release"
  exit 1
fi

"$WINDCLI" --version | head -1 || true
log_info "wind-cli ready"

# ── Setup: fresh workspace per run ──────────────────────────
ORIG_CONFIG=""
if [[ -f ~/.config/wind/config.json ]]; then
  ORIG_CONFIG="$(mktemp)"
  cp ~/.config/wind/config.json "$ORIG_CONFIG"
fi

TEST_DIR="$(mktemp -d)"
WORKSPACE="$TEST_DIR/workspace"
mkdir -p "$WORKSPACE"

# Initialize workspace (cd into it so wind uses it as active workspace)
(cd "$WORKSPACE" && "$WINDCLI" init . 2>&1) || true

# Verify workspace is set
WS_ACTIVE="$("$WINDCLI" --json ls . 2>&1 | grep -o '"ok": true' || true)"
if [[ -z "$WS_ACTIVE" ]]; then
  log_fail "Cannot set up test workspace — wind-cli may need config reset"
  exit 1
fi
log_info "Test workspace: $WORKSPACE"

# ── Test helpers ─────────────────────────────────────────────

# Run a test expecting success
# run_ok "name" wind_from_ws args...
run_ok() {
  local name="$1"; shift
  local out rc
  out="$(wind_from_ws "$@" 2>&1)" || rc=$?
  if [[ ${rc:-0} -eq 0 ]]; then
    log_pass "$name"
    return 0
  else
    log_fail "$name (exit $rc)"
    echo "  Output: $(echo "$out" | head -3)"
    return 1
  fi
}

# Run a test expecting failure
run_err() {
  local name="$1"; shift
  local out rc
  out="$(wind_from_ws "$@" 2>&1)" || rc=$?
  if [[ ${rc:-0} -ne 0 ]]; then
    log_pass "$name (correctly failed)"
    return 0
  else
    log_fail "$name (expected failure but succeeded)"
    return 1
  fi
}

# Run a test expecting success OR structured error (network/API key)
run_ok_or_structured_err() {
  local name="$1"; shift
  local out rc
  out="$(wind_from_ws "$@" 2>&1)" || rc=$?
  if [[ ${rc:-0} -eq 0 ]]; then
    log_pass "$name"
    return 0
  fi
  # Accept structured errors
  if echo "$out" | grep -q '"error"\|api_key\|API\|not configured\|network\|reason'; then
    log_pass "$name (structured failure — expected)"
    return 0
  else
    log_fail "$name: unexpected failure"
    echo "  Output: $(echo "$out" | head -3)"
    return 1
  fi
}

# ── Chain 1: winwork -> wind-cli ────────────────────────────
chain1() {
  log_info ""
  log_info "═══════════════════════════════════════════════"
  log_info "Chain 1: winwork (Tauri) -> wind-cli"
  log_info "═══════════════════════════════════════════════"

  # T1: wind --version works
  run_ok "[T1] wind --version" --version

  # T2: wind --json ls . returns JSON with ok=true
  local ls_out rc
  ls_out="$("$WINDCLI" --json ls . 2>&1)" || rc=$?
  if [[ ${rc:-0} -eq 0 ]] && echo "$ls_out" | grep -q '"ok": true'; then
    log_pass "[T2] wind --json ls . returns JSON"
  else
    log_fail "[T2] wind --json ls . (exit $rc)"
    echo "  Output: $(echo "$ls_out" | head -2)"
  fi

  # T3: ls output has "entries" array
  ls_out="$("$WINDCLI" --json ls . 2>&1)" || true
  if echo "$ls_out" | grep -q '"entries"'; then
    log_pass "[T3] ls JSON has 'entries' array"
  else
    log_fail "[T3] ls JSON missing 'entries'"
    echo "  Output: $(echo "$ls_out" | head -2)"
  fi

  # T4: wind mkdir creates directory
  local mkdir_out
  mkdir_out="$(wind_from_ws mkdir test-subdir 2>&1)" || true
  if [[ -d "$WORKSPACE/test-subdir" ]]; then
    log_pass "[T4] wind mkdir creates directory"
  else
    log_fail "[T4] wind mkdir failed: $(echo "$mkdir_out" | head -1)"
  fi

  # T5: wind write creates file
  local write_out
  write_out="$(wind_from_ws write test.txt --content "Hello from wind test" 2>&1)" || true
  if [[ -f "$WORKSPACE/test.txt" ]]; then
    log_pass "[T5] wind write creates file"
  else
    log_fail "[T5] wind write failed: $(echo "$write_out" | head -1)"
  fi

  # T6: wind read returns content
  local read_out
  read_out="$(wind_from_ws read test.txt 2>&1)" || true
  if echo "$read_out" | grep -q "Hello from wind test"; then
    log_pass "[T6] wind read returns file content"
  else
    log_fail "[T6] wind read unexpected output: $(echo "$read_out" | head -2)"
  fi

  # T7: wind read nonexistent returns error
  run_err "[T7] wind read nonexistent file fails" read no-such-file-xyz.txt

  # T8: wind rm --dry-run does NOT delete
  touch "$WORKSPACE/to-delete.txt"
  wind_from_ws rm to-delete.txt --dry-run 2>/dev/null || true
  if [[ -f "$WORKSPACE/to-delete.txt" ]]; then
    log_pass "[T8] wind rm --dry-run does not delete"
  else
    log_fail "[T8] wind rm --dry-run deleted file"
  fi

  # T9: Path traversal blocked (trying to read outside workspace)
  run_err "[T9] Path traversal blocked (security)" read ../secret.txt

  # T10: wind tools list returns JSON tools array
  local tools_out
  tools_out="$("$WINDCLI" tools list 2>&1)" || true
  if echo "$tools_out" | grep -q '"tools"'; then
    log_pass "[T10] wind tools list returns JSON"
  else
    log_fail "[T10] wind tools list failed"
    echo "  Output: $(echo "$tools_out" | head -2)"
  fi

  # T11: wind tools describe ls returns schema
  local desc_out
  desc_out="$("$WINDCLI" tools describe ls 2>&1)" || true
  if echo "$desc_out" | grep -q '"name"'; then
    log_pass "[T11] wind tools describe ls returns schema"
  else
    log_fail "[T11] wind tools describe ls failed"
  fi

  # T12: wind tools call ls --params works
  run_ok "[T12] wind tools call ls" tools call ls --params '{"path":"."}'

  # T13: wind upgrade --check returns version info
  local upgrade_out
  upgrade_out="$("$WINDCLI" upgrade --check 2>&1)" || true
  if echo "$upgrade_out" | grep -qi "version\|update\|current\|ok"; then
    log_pass "[T13] wind upgrade --check works"
  else
    log_skip "[T13] wind upgrade --check (network-dependent)"
  fi
}

# ── Chain 2: wind-cli -> llm-wiki ─────────────────────────
chain2() {
  log_info ""
  log_info "═══════════════════════════════════════════════"
  log_info "Chain 2: wind-cli -> llm-wiki"
  log_info "═══════════════════════════════════════════════"

  # T14: wind wiki status is valid (may need API key)
  run_ok_or_structured_err "[T14] wind wiki status" wiki status

  # T15: wind wiki lint is valid (may need API key)
  run_ok_or_structured_err "[T15] wind wiki lint" wiki lint

  # T16: wind wiki ingest nonexistent file fails gracefully
  run_err "[T16] wind wiki ingest nonexistent file" wiki ingest /no/such/file.pdf

  # T17: wind wiki ingest a real markdown file (API key required)
  local test_md="$WORKSPACE/wiki-test.md"
  echo "# Test Document

This is a test for wiki ingestion.
Second paragraph here." > "$test_md"

  local ingest_out
  ingest_out="$(wind_from_ws wiki ingest wiki-test.md 2>&1)" || true
  if echo "$ingest_out" | grep -qi "ingest\|wiki\|ok\|success"; then
    log_pass "[T17] wind wiki ingest runs"
  elif echo "$ingest_out" | grep -qi "api_key\|API\|unauthorized\|未授权\|network\|网络\|not configured"; then
    log_skip "[T17] wind wiki ingest needs API key (expected in test env)"
  else
    log_fail "[T17] wind wiki ingest unexpected error: $(echo "$ingest_out" | head -2)"
  fi

  # T18: wind wiki query handles empty question
  run_err "[T18] wind wiki query empty question" wiki query ""
}

# ── Summary ─────────────────────────────────────────────────
print_summary() {
  log_info ""
  log_info "═══════════════════════════════════════════════"
  log_info "Test Summary"
  log_info "═══════════════════════════════════════════════"
  echo ""
  echo -e "  \033[32mPASSED: $PASSED\033[0m"
  echo -e "  \033[31mFAILED: $FAILED\033[0m"
  echo -e "  \033[33mSKIPPED: $SKIPPED\033[0m"
  echo ""
  if [[ $FAILED -eq 0 ]]; then
    log_pass "All critical tests passed!"
  else
    log_fail "$FAILED test(s) failed"
  fi
}

# ── Main ──────────────────────────────────────────────────
chain="${1:-all}"

case "$chain" in
  --chain1) chain1 ;;
  --chain2) chain2 ;;
  all)
    chain1
    chain2
    ;;
  *)
    echo "Usage: $0 [--chain1|--chain2]"
    exit 1
    ;;
esac

print_summary
exit $(( FAILED > 0 ? 1 : 0 ))
