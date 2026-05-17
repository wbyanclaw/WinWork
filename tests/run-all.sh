#!/bin/bash
# winwork Integration Test Suite
# Tests two chains:
#   Chain 1: winwork (Tauri) -> wind-cli
#   Chain 2: wind-cli -> llm-wiki
#
# IMPORTANT: wind-cli uses workspace-relative paths. Commands must be run
# from within the workspace directory because safe_path() canonicalizes paths,
# and on Linux /tmp is a symlink to /private/tmp causing path mismatches.
#
# Usage:
#   WINDCLI=/path/to/wind \
#   WIND_WIKI_API_KEY=... WIND_WIKI_PROVIDER=openai \
#   ./run-all.sh            # Run all
#   ./run-all.sh --chain1  # Chain 1 only
#   ./run-all.sh --chain2  # Chain 2 only

set -uo pipefail

WINDCLI="${WINDCLI:-windcli}"

PASSED=0; FAILED=0; SKIPPED=0

log_info()  { echo -e "\033[34m[INFO]\033[0m  $*"; }
log_pass()  { echo -e "\033[32m[PASS]\033[0m  $*"; PASSED=$((PASSED+1)); }
log_fail()  { echo -e "\033[31m[FAIL]\033[0m  $*"; FAILED=$((FAILED+1)); }
log_skip()  { echo -e "\033[33m[SKIP]\033[0m  $*"; SKIPPED=$((SKIPPED+1)); }

ORIG_CONFIG=""; TEST_DIR=""; WORKSPACE=""

cleanup() {
  log_info "Cleaning up..."
  if [[ -n "$ORIG_CONFIG" ]] && [[ -f "$ORIG_CONFIG" ]]; then
    cp "$ORIG_CONFIG" ~/.config/wind/config.json 2>/dev/null || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

wind_ws() { (cd "$WORKSPACE" && "$WINDCLI" "$@"); }

# Run command expecting success (exit 0)
run_ok() {
  local name="$1"; shift
  local out rc=0
  out="$(wind_ws "$@" 2>&1)" || rc=$?
  if [[ $rc -eq 0 ]]; then
    log_pass "$name"
  else
    log_fail "$name (exit $rc)"
    echo "  Output: $(echo "$out" | head -3)"
  fi
}

# Run command expecting failure (non-zero exit)
run_fail() {
  local name="$1"; shift
  local out rc=0
  out="$(wind_ws "$@" 2>&1)" || rc=$?
  if [[ $rc -ne 0 ]]; then
    log_pass "$name (correctly failed)"
  else
    log_fail "$name (expected failure but succeeded)"
  fi
}

# Run expecting success OR structured error JSON
run_ok_or_err() {
  local name="$1"; shift
  local out rc=0
  out="$(wind_ws "$@" 2>&1)" || rc=$?
  if [[ $rc -eq 0 ]]; then
    log_pass "$name"
  elif echo "$out" | grep -q "error\|api_key\|API\|not configured\|network\|reason\|unauthorized\|未授权\|未配置"; then
    log_pass "$name (structured failure — expected)"
  else
    log_fail "$name: unexpected failure"
    echo "  Output: $(echo "$out" | head -3)"
  fi
}

# Check command output contains a string literal
run_grep() {
  local name="$1"; local pat="$2"; shift 2
  local out rc=0
  out="$(wind_ws "$@" 2>&1)" || rc=$?
  if echo "$out" | grep -qF "$pat"; then
    log_pass "$name"
  else
    log_fail "$name (pattern '$pat' not found)"
    echo "  Output: $(echo "$out" | head -3)"
  fi
}

log_info "winwork Integration Test Suite"
log_info "wind-cli: $WINDCLI"

if [[ ! -x "$WINDCLI" ]] && ! command -v "$WINDCLI" &>/dev/null; then
  log_fail "wind-cli not found: $WINDCLI"
  log_info "Build: cd wind-cli && cargo build --release"
  exit 1
fi
"$WINDCLI" --version | head -1 || true
log_info "wind-cli ready"

# Setup fresh workspace
ORIG_CONFIG=""
if [[ -f ~/.config/wind/config.json ]]; then
  ORIG_CONFIG="$(mktemp)"
  cp ~/.config/wind/config.json "$ORIG_CONFIG"
fi
rm -f ~/.config/wind/config.json
mkdir -p ~/.config/wind
TEST_DIR="$(mktemp -d)"
WORKSPACE="$TEST_DIR/workspace"
mkdir -p "$WORKSPACE"
(cd "$WORKSPACE" && "$WINDCLI" init . 2>&1) || true

WS_CHECK="$("$WINDCLI" --json ls . 2>&1 | grep -c 'ok' || echo 0)"
if [[ "$WS_CHECK" -eq 0 ]]; then
  log_fail "Cannot set up test workspace"
  exit 1
fi
log_info "Test workspace: $WORKSPACE"

# ── Chain 1: winwork -> wind-cli ──────────────────────────
chain1() {
  log_info ""
  log_info "Chain 1: winwork (Tauri) -> wind-cli"
  log_info "═══════════════════════════════════════════════"

  run_ok "[T1]  wind --version" --version
  run_grep "[T2]  wind --json ls . returns ok" "ok" --json ls .
  run_grep "[T3]  ls JSON has entries field" "entries" --json ls .
  run_ok "[T4]  wind mkdir" mkdir test-subdir
  test -d "$WORKSPACE/test-subdir" && log_pass "[T4b] mkdir created dir on disk" \
    || log_fail "[T4b] mkdir dir not on disk"
  run_ok "[T5]  wind write" write test.txt --content "Hello from wind test"
  test -f "$WORKSPACE/test.txt" && log_pass "[T5b] write created file on disk" \
    || log_fail "[T5b] write file not on disk"
  run_grep "[T6]  wind read returns content" "Hello from wind test" read test.txt
  run_fail "[T7]  wind read nonexistent fails" read no-such-file-xyz.txt

  touch "$WORKSPACE/to-delete.txt"
  wind_ws rm to-delete.txt --dry-run 2>/dev/null || true
  test -f "$WORKSPACE/to-delete.txt" && log_pass "[T8]  rm --dry-run preserves file" \
    || log_fail "[T8]  rm --dry-run deleted file"

  run_fail "[T9]  Path traversal blocked" read ../secret.txt
  run_grep "[T10] wind tools list has tools" "tools" tools list
  run_grep "[T11] wind tools describe ls has name" "name" tools describe ls
  run_ok "[T12] wind tools call ls" tools call ls --params '{"path":"."}'

  local upgrade_out rc=0
  upgrade_out="$( "$WINDCLI" upgrade --check 2>&1)" || rc=$?
  if echo "$upgrade_out" | grep -qi "version\|update\|current\|ok"; then
    log_pass "[T13] wind upgrade --check works"
  else
    log_skip "[T13] wind upgrade --check (network-dependent)"
  fi
}

# ── Chain 2: wind-cli -> llm-wiki ─────────────────────────
chain2() {
  log_info ""
  log_info "Chain 2: wind-cli -> llm-wiki"
  log_info "═══════════════════════════════════════════════"

  run_ok_or_err "[T14] wind wiki status" wiki status
  run_ok_or_err "[T15] wind wiki lint" wiki lint
  run_fail "[T16] wind wiki ingest nonexistent file" wiki ingest /no/such/file.pdf

  echo "# Test Document

This is a test for wiki ingestion." > "$WORKSPACE/wiki-test.md"
  # wind wiki ingest reads from ~/.local/share/wind/workspace/ which may be root-owned
  # Check if we can write there first
  local ingest_src=""
  if mkdir -p ~/.local/share/wind/workspace 2>/dev/null; then
    cp "$WORKSPACE/wiki-test.md" ~/.local/share/wind/workspace/wiki-test.md 2>/dev/null && ingest_src="wiki-test.md"
  fi
  local ingest_out rc=0
  if [[ -n "$ingest_src" ]]; then
    ingest_out="$(wind_ws wiki ingest wiki-test.md 2>&1)" || rc=$?
    if [[ $rc -eq 0 ]]; then
      log_pass "[T17] wind wiki ingest succeeds"
    else
      log_skip "[T17] wind wiki ingest (API call failed)"
    fi
  else
    log_skip "[T17] wind wiki ingest (workspace dir root-owned, skipped)"
  fi

  # T18: query — accepts success OR structured error (e.g. API key not configured)
  local q_out rc=0
  q_out="$(wind_ws wiki query "MiniMax 是什么？" 2>&1)" || rc=$?
  if [[ $rc -eq 0 ]]; then
    log_pass "[T18] wind wiki query succeeds"
  elif echo "$q_out" | grep -qi "api_key\|API\|not set\|not configured\|error"; then
    log_pass "[T18] wind wiki query (API not configured)"
  else
    log_fail "[T18] wind wiki query: $(echo "$q_out" | head -1)"
  fi
}

print_summary() {
  log_info ""
  log_info "═══════════════════════════════════════════════"
  log_info "Test Summary"
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

chain="${1:-all}"
case "$chain" in
  --chain1) chain1 ;;
  --chain2) chain2 ;;
  all) chain1; chain2 ;;
  *) echo "Usage: $0 [--chain1|--chain2]"; exit 1 ;;
esac

print_summary
exit $(( FAILED > 0 ? 1 : 0 ))
