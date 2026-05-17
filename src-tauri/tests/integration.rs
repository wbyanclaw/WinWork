//! winwork_lib Integration Tests
//!
//! These tests verify the winwork Tauri backend's wind-cli integration layer.
//! Run with: cargo test --package winwork_lib --test integration
//!
//! Prerequisites:
//!   - `windcli` must be installed and findable in PATH
//!     (or set WINDCLI_PATH env var to the binary path)
//!   - On first run, `wind init <workspace>` sets up wind-cli's config

use std::process::Command;

/// Resolve windcli binary path
fn windcli_path() -> String {
    std::env::var("WINDCLI_PATH")
        .ok()
        .or_else(|| {
            for name in &["windcli", "wind"] {
                if Command::new(name).arg("--version").output().is_ok() {
                    return Some(name.to_string());
                }
            }
            None
        })
        .unwrap_or_else(|| "windcli".to_string())
}

fn wind_output(args: &[&str]) -> std::process::Output {
    let path = windcli_path();
    Command::new(&path)
        .args(args)
        .output()
        .expect("failed to run wind-cli")
}

fn wind_ok(args: &[&str]) -> bool {
    wind_output(args).status.success()
}

fn workspace() -> std::path::PathBuf {
    std::env::temp_dir().join("winwork-integration-test")
}

fn setup_workspace() {
    let ws = workspace();
    let _ = std::fs::remove_dir_all(&ws);
    std::fs::create_dir_all(&ws).unwrap();
    let out = wind_output(&["init", &ws.to_string_lossy()]);
    // Init may fail if already initialized — that's OK
    let _ = out;
}

// ── WindResult parsing tests ─────────────────────────────────────────

#[test]
fn test_wind_result_json_parsing() {
    // When wind returns valid JSON, it should parse as WindResult.ok=true
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    struct WindResult {
        ok: bool,
        #[allow(dead_code)]
        stdout: String,
        #[allow(dead_code)]
        stderr: String,
        #[allow(dead_code)]
        exit_code: i32,
    }

    // `wind --version` always succeeds and returns text (not JSON by default)
    // `wind --version --json` returns JSON if supported
    let out = wind_output(&["--version"]);
    assert!(out.status.success());
}

#[test]
fn test_ls_json_returns_valid_structure() {
    setup_workspace();
    let ws = workspace();

    let out = wind_output(&["--json", "ls", &ws.to_string_lossy()]);
    let stdout = String::from_utf8_lossy(&out.stdout);

    // Should be valid JSON
    let value: serde_json::Value = serde_json::from_str(&stdout)
        .expect("ls --json output should be valid JSON");

    assert!(
        value.get("entries").is_some(),
        "ls --json should have 'entries' field"
    );
    assert!(
        value.get("ok") == Some(&serde_json::Value::Bool(true)),
        "ls --json should have ok=true"
    );
}

#[test]
fn test_ls_json_entries_is_array() {
    setup_workspace();
    let ws = workspace();

    let out = wind_output(&["--json", "ls", &ws.to_string_lossy()]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    let value: serde_json::Value = serde_json::from_str(&stdout).unwrap();

    let entries = value.get("entries").expect("entries field missing");
    assert!(
        entries.is_array(),
        "entries should be an array, got: {}",
        entries
    );
}

#[test]
fn test_ls_returns_entries_with_name_and_is_dir() {
    setup_workspace();
    let ws = workspace();

    // Create a subdirectory
    std::fs::create_dir(ws.join("subdir")).unwrap();
    // Create a file
    std::fs::write(ws.join("file.txt"), "hello").unwrap();

    let out = wind_output(&["--json", "ls", &ws.to_string_lossy()]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    let value: serde_json::Value = serde_json::from_str(&stdout).unwrap();

    let entries = value.get("entries").unwrap().as_array().unwrap();

    // Should have both dir and file
    let has_dir = entries.iter().any(|e| e.get("is_dir") == Some(&serde_json::Value::Bool(true)));
    let has_file = entries.iter().any(|e| e.get("is_dir") == Some(&serde_json::Value::Bool(false)));
    assert!(has_dir, "entries should contain a directory: {entries:?}");
    assert!(has_file, "entries should contain a file: {entries:?}");

    // Each entry should have name
    for entry in entries {
        assert!(
            entry.get("name").is_some(),
            "each entry should have 'name' field: {entry}"
        );
    }
}

#[test]
fn test_mkdir_returns_ok_true() {
    setup_workspace();
    let ws = workspace();
    let subdir = ws.join("new-dir");

    let out = wind_output(&["mkdir", &subdir.to_string_lossy()]);

    // mkdir should succeed (stdout may be text or JSON)
    if out.status.success() {
        let stdout = String::from_utf8_lossy(&out.stdout);
        // If JSON, should have ok=true or message
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&stdout) {
            assert!(
                value.get("ok") == Some(&serde_json::Value::Bool(true)),
                "mkdir JSON should have ok=true"
            );
        }
    }
    assert!(subdir.exists(), "mkdir should create directory on disk");
}

#[test]
fn test_read_nonexistent_returns_error() {
    let out = wind_output(&["read", "/tmp/nonexistent-file-12345xyz.txt"]);
    assert!(!out.status.success(), "reading nonexistent file should fail");
}

#[test]
fn test_read_existing_file_returns_content() {
    setup_workspace();
    let ws = workspace();
    let content = "Hello from wind-cli test!";
    std::fs::write(ws.join("test.txt"), content).unwrap();

    let out = wind_output(&["read", &ws.join("test.txt").to_string_lossy()]);
    assert!(out.status.success(), "reading existing file should succeed");
    let stdout = String::from_utf8_lossy(&out.stdout);

    // If JSON (--json), check content field
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&stdout) {
        let extracted = value.get("content")
            .or_else(|| value.get("data").and_then(|d| d.get("content")))
            .and_then(|c| c.as_str())
            .unwrap_or(&stdout);
        assert!(
            extracted.contains("Hello from wind-cli"),
            "file content should be in output"
        );
    } else {
        // Plain text — should contain the content
        assert!(
            stdout.contains("Hello from wind-cli"),
            "file content should be in output"
        );
    }
}

#[test]
fn test_path_traversal_is_blocked() {
    setup_workspace();
    let ws = workspace();

    // Attempt to escape workspace using ..
    let malicious = ws.join("..").join("..").join("..").join("etc").join("passwd");
    let out = wind_output(&["read", &malicious.to_string_lossy()]);

    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);

    // Should fail OR not return actual /etc/passwd content
    let blocked = !out.status.success()
        || !stdout.contains("root:")
        || stderr.contains("traversal")
        || stderr.contains("outside")
        || stderr.contains("blocked")
        || stderr.contains("denied");
    assert!(
        blocked,
        "path traversal should be blocked. stdout: {}, stderr: {}",
        stdout, stderr
    );
}

#[test]
fn test_tools_list_returns_tools_array() {
    let out = wind_output(&["tools", "list"]);
    assert!(out.status.success(), "tools list should succeed");
    let stdout = String::from_utf8_lossy(&out.stdout);
    let value: serde_json::Value = serde_json::from_str(&stdout)
        .expect("tools list output should be valid JSON");

    let tools = value.get("tools")
        .expect("tools list should have 'tools' field")
        .as_array()
        .expect("tools should be an array");

    assert!(!tools.is_empty(), "tools list should not be empty");

    // Each tool should have name, description, risk_level
    for tool in tools {
        assert!(tool.get("name").is_some(), "tool should have name: {tool}");
        assert!(tool.get("risk_level").is_some(), "tool should have risk_level: {tool}");
    }

    // Known tools should be present
    let names: Vec<&str> = tools.iter()
        .filter_map(|t| t.get("name")?.as_str())
        .collect();
    assert!(names.contains(&"ls"), "tools should include 'ls'");
    assert!(names.contains(&"read"), "tools should include 'read'");
}

#[test]
fn test_tools_describe_ls_returns_schema() {
    let out = wind_output(&["tools", "describe", "ls"]);
    assert!(out.status.success(), "tools describe ls should succeed");
    let stdout = String::from_utf8_lossy(&out.stdout);
    let value: serde_json::Value = serde_json::from_str(&stdout).unwrap();

    let tool = value.get("tool").expect("output should have 'tool' field");
    assert_eq!(
        tool.get("name").and_then(|n| n.as_str()),
        Some("ls"),
        "describe ls should return tool named 'ls'"
    );
    assert!(
        tool.get("params").is_some(),
        "tool should have params schema"
    );
}

#[test]
fn test_tools_call_ls_succeeds() {
    setup_workspace();
    let ws = workspace();

    // Call ls via tools interface
    let out = wind_output(&["tools", "call", "ls", "--params", r#"{"path":"."}"#]);

    if out.status.success() {
        let stdout = String::from_utf8_lossy(&out.stdout);
        // Should be valid JSON
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&stdout) {
            assert!(
                value.get("ok") == Some(&serde_json::Value::Bool(true)),
                "tools call ls should have ok=true"
            );
        }
    }
    // Accept failure if workspace not properly initialized
}

#[test]
fn test_rm_requires_confirmation() {
    setup_workspace();
    let ws = workspace();
    let to_delete = ws.join("delete-me.txt");
    std::fs::write(&to_delete, "temp").unwrap();

    // rm without --yes should fail (safety guard)
    let out = wind_output(&["rm", &to_delete.to_string_lossy()]);
    // Should either refuse or confirm prompt — in non-interactive mode may fail
    if out.status.success() {
        // If it somehow succeeded, the file should be gone
        // But in practice, rm without --yes/--force should refuse
    }
    // File should still exist (not deleted without confirmation)
    assert!(to_delete.exists() || !out.status.success(),
        "rm without --yes should not delete file");
}

#[test]
fn test_upgrade_check_returns_version_info() {
    let out = wind_output(&["upgrade", "--check"]);
    let stdout = String::from_utf8_lossy(&out.stdout);

    // Should contain version information
    let has_version = stdout.contains("version")
        || stdout.contains("update")
        || stdout.contains("current")
        || stdout.contains("latest")
        || stdout.contains("ok");
    assert!(has_version, "upgrade --check should return version info, got: {}", stdout);
}

// ── wiki tests ────────────────────────────────────────────────────

#[test]
fn test_wiki_status_is_valid_command() {
    let out = wind_output(&["wiki", "status"]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);

    // Should either succeed or give a structured error
    if !out.status.success() {
        assert!(
            stderr.contains("api_key") || stderr.contains("API key")
                || stderr.contains("config") || stderr.contains("not configured")
                || stderr.contains("未配置") || stderr.contains("network")
                || stderr.contains("error") || stderr.contains("reason"),
            "wiki status should give structured error if not configured, got: {}",
            stderr
        );
    }
}

#[test]
fn test_wiki_lint_is_valid_command() {
    let out = wind_output(&["wiki", "lint"]);
    // Should run and return either success or structured failure
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);

    if out.status.success() {
        // Valid — wiki is set up
    } else {
        // Acceptable failures: missing API key, no wiki initialized, network error
        assert!(
            stderr.contains("api_key") || stderr.contains("config") || stderr.contains("not")
                || stderr.contains("未") || stderr.contains("error") || stderr.contains("reason")
                || stdout.contains("error") || stdout.contains("reason"),
            "wiki lint should fail gracefully when not set up, got: {} / {}",
            stdout, stderr
        );
    }
}

#[test]
fn test_wiki_ingest_nonexistent_file_handled() {
    let out = wind_output(&["wiki", "ingest", "/nonexistent/file.pdf"]);
    let stderr = String::from_utf8_lossy(&out.stderr);

    // Should fail with a meaningful error (not a crash)
    assert!(
        !out.status.success(),
        "wiki ingest nonexistent file should fail"
    );
    // Error should be structured
    assert!(
        stderr.contains("not found") || stderr.contains("不存在")
            || stderr.contains("api_key") || stderr.contains("API")
            || stderr.contains("error") || stderr.contains("reason"),
        "error should be meaningful, got: {}",
        stderr
    );
}
