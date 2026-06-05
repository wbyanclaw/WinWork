//! winwork - AI Agent file management powered by wind-cli.
//!
//! Design principle: HTML/JS implements all business logic, Rust is only a bridge.

pub mod commands;
pub mod error;
pub mod state;
pub mod wind;

use crate::commands::shell::{run_command_impl, run_command_with_stdin_impl, CommandResult};
use crate::wind::WindResult;
use std::process::{Command as StdCommand, Stdio};
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::open_url as opener_open_url;

/// Execute wind-cli command with structured args.
#[tauri::command]
fn run_command(args: Vec<String>) -> CommandResult {
    run_command_impl(args)
}

/// Execute wind-cli command with stdin input (for write commands).
#[tauri::command]
fn run_command_with_stdin(args: Vec<String>, stdin: String) -> CommandResult {
    run_command_with_stdin_impl(args, stdin)
}

/// Check for wind-cli upgrades.
#[tauri::command]
fn check_upgrade() -> WindResult {
    let result = crate::wind::check_upgrade();
    WindResult {
        ok: result.get("found").map(|v| v == "true").unwrap_or(false),
        stdout: result.get("output").cloned().unwrap_or_default(),
        stderr: result.get("error").cloned().unwrap_or_default(),
        exit_code: 0,
        data: Some(serde_json::to_value(&result).unwrap_or_default()),
    }
}

/// Trigger wind-cli upgrade in background thread with progress events.
#[tauri::command]
async fn do_upgrade(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();

    // Spawn upgrade in background thread
    std::thread::spawn(move || {
        let result = crate::wind::do_upgrade_with_progress(&app_clone);

        // Emit completion event
        let _ = app_clone.emit("upgrade-complete", &result);
    });

    Ok(())
}

/// Get upgrade progress stream (for polling).
#[tauri::command]
async fn get_upgrade_progress() -> String {
    crate::wind::get_upgrade_progress()
}

/// Read file content from the workspace.
#[tauri::command]
fn read_file(path: String) -> WindResult {
    crate::wind::read_file(&path)
}

/// List files in a directory (or workspace root if no path provided).
#[tauri::command]
fn list_files(path: Option<String>) -> WindResult {
    crate::wind::list_files(path)
}

/// Open folder selection dialog.
#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> WindResult {
    let folder = app.dialog().file().blocking_pick_folder();
    match folder {
        Some(path) => WindResult {
            ok: true,
            stdout: path.to_string(),
            stderr: String::new(),
            exit_code: 0,
            data: Some(serde_json::json!({ "path": path.to_string() })),
        },
        None => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: "No folder selected".to_string(),
            exit_code: 1,
            data: None,
        },
    }
}

/// Get current workspace path.
#[tauri::command]
fn get_workspace_path() -> String {
    crate::state::get_workspace_configured_path()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "".to_string())
}

/// Set workspace path.
#[tauri::command]
fn set_workspace_path(path: String) -> Result<(), String> {
    crate::state::set_workspace_path(&path)
}

/// Get wiki path.
#[tauri::command]
fn get_wiki_path() -> String {
    crate::wind::get_wiki_path()
}

/// Get winwork version from Cargo.toml.
#[tauri::command]
fn get_winwork_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get combined environment status (winwork, windcli, wiki).
#[tauri::command]
fn get_environment_status() -> serde_json::Value {
    let windcli = crate::wind::check_windcli();
    let winwork_version = env!("CARGO_PKG_VERSION").to_string();
    let wiki = crate::wind::check_llm_wiki();
    serde_json::json!({
        "winworkVersion": winwork_version,
        "windcli": windcli,
        "wiki": wiki
    })
}

/// Check wind-cli status (legacy API).
#[tauri::command]
fn check_windcli() -> serde_json::Value {
    let result = crate::wind::check_windcli();
    serde_json::json!(result)
}

/// Check wiki status.
#[tauri::command]
fn wiki_status() -> crate::wind::WindResult {
    let wiki = crate::wind::check_llm_wiki();
    let found = wiki.get("found").map(|v| v == "true").unwrap_or(false);
    let reason = wiki.get("reason").cloned().unwrap_or_default();
    crate::wind::WindResult {
        ok: found,
        stdout: if found { "wiki available".to_string() } else { String::new() },
        stderr: reason,
        exit_code: if found { 0 } else { 1 },
        data: Some(serde_json::to_value(wiki).unwrap_or_default()),
    }
}

/// Save state data with a given key.
#[tauri::command]
fn save_state(key: String, data: serde_json::Value) -> Result<(), String> {
    crate::state::save_state(&key, &data)
}

/// Load state data by key.
#[tauri::command]
fn load_state(key: String) -> Result<Option<serde_json::Value>, String> {
    let result = crate::state::load_state(&key)?;
    if result.is_null() {
        Ok(None)
    } else {
        Ok(Some(result))
    }
}

/// Load config (returns the full config Map).
#[tauri::command]
fn load_config() -> serde_json::Map<String, serde_json::Value> {
    crate::state::load_config()
}

/// Save config (replaces the full config).
#[tauri::command]
fn save_config(config: serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    crate::state::save_config(&config)
}

/// Open a URL in the default browser.
#[tauri::command]
fn open_url(url: String) -> WindResult {
    match opener_open_url(&url, None::<&str>) {
        Ok(_) => WindResult {
            ok: true,
            stdout: format!("Opened: {}", url),
            stderr: String::new(),
            exit_code: 0,
            data: None,
        },
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("Failed to open URL: {}", e),
            exit_code: 1,
            data: None,
        },
    }
}

/// Get winwork root directory path.
#[tauri::command]
fn get_winwork_root() -> String {
    crate::state::winwork_root()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "~/.winwork".to_string())
}

/// Initialize default files (README.md for workspace and wiki).
/// Called on first run to create informative default files.
#[tauri::command]
fn init_default_files() -> Result<(), String> {
    if !crate::state::is_first_run() {
        return Ok(()); // Already initialized
    }
    crate::state::create_default_readmes()
}

/// Ensure a workspace directory exists and return its path.
#[tauri::command]
fn ensure_workspace_dir(name: String) -> Result<String, String> {
    crate::state::ensure_workspace_dir(&name)
}

/// List all workspace names.
#[tauri::command]
fn list_workspaces() -> Result<Vec<String>, String> {
    crate::state::list_workspaces()
}

/// Delete a workspace by name.
#[tauri::command]
fn delete_workspace(name: String) -> Result<(), String> {
    crate::state::delete_workspace(&name)
}

/// Save chat history.
#[tauri::command]
fn save_chat_history(messages: Vec<serde_json::Value>) -> Result<(), String> {
    crate::state::save_state("chat_history.json", &serde_json::json!({ "messages": messages }))
}

/// Load chat history.
#[tauri::command]
fn load_chat_history() -> Result<Vec<serde_json::Value>, String> {
    let data = crate::state::load_state("chat_history.json")?;
    if let Some(msgs) = data.get("messages").and_then(|v| v.as_array()) {
        Ok(msgs.clone())
    } else {
        Ok(vec![])
    }
}

// ── v0.2.29 must-fix handlers (A group) ────────────────────────────
// Spec: docs/superpowers/specs/2026-06-04-winwork-v0.2.29-usable-release-design.md
// Audit: scripts/audit-invoke.sh

/// L0/L1: check if llm-wiki is available. Returns the same HashMap the
/// legacy `wiki_status` wraps. Frontend calls this directly from
/// `checkAllEnv()` (index.html:735) and was previously crashing because
/// the handler was never registered in `generate_handler!`.
#[tauri::command]
fn check_llm_wiki() -> std::collections::HashMap<String, String> {
    crate::wind::check_llm_wiki()
}

/// L1: open the wind-cli releases page in the default browser.
/// Frontend wires this to the "⚡ 一键安装 wind-cli" button on the
/// install modal (index.html:824). Per spec §3.1 L1.2 the install
/// entry must work on a fresh machine.
#[tauri::command]
fn trigger_install() -> WindResult {
    const URL: &str = "https://github.com/wbyanclaw/wind-cli/releases/latest";
    match opener_open_url(URL, None::<&str>) {
        Ok(_) => WindResult {
            ok: true,
            stdout: format!("Opened: {}", URL),
            stderr: String::new(),
            exit_code: 0,
            data: Some(serde_json::json!({ "url": URL })),
        },
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("Failed to open URL: {}", e),
            exit_code: 1,
            data: None,
        },
    }
}

/// L2: list files in the configured workspace. Frontend wires this to
/// the workspace section of the left file tree (index.html:497). Thin
/// wrapper over `list_files(None)` so callers don't have to know the
/// workspace root path.
///
/// v0.2.30.1 hotfix: optional `subpath` parameter to support folder
/// expand in the left file tree. When None/empty, lists the root.
#[tauri::command]
fn list_workspace(subpath: Option<String>) -> WindResult {
    match subpath.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(rel) => {
            // Resolve relative subpath against workspace root.
            let root = crate::wind::get_workspace_path();
            let joined = std::path::Path::new(&root).join(rel);
            crate::wind::list_files(Some(joined.to_string_lossy().to_string()))
        }
        None => crate::wind::list_files(None),
    }
}

/// L2: list files in the configured wiki directory. Frontend wires
/// this to the wiki section of the left file tree (index.html:502).
#[tauri::command]
fn list_wiki() -> WindResult {
    let path = crate::wind::get_wiki_path();
    crate::wind::list_files(Some(path))
}

/// L2: write a file at a workspace-relative path. Frontend wires this
/// to the "new file" button (index.html:655). The `path` is relative
/// to the workspace root, matching `read_file` semantics.
#[tauri::command]
fn write_file(path: String, content: String) -> WindResult {
    use std::io::Write;

    let workspace = crate::wind::get_workspace_path();
    let ws = workspace.trim_end_matches('\\').trim_end_matches('/');

    let windcli = crate::wind::get_windcli_path();
    let mut cmd = StdCommand::new(&windcli);
    cmd.args([
        "--json",
        "--workspace",
        ws,
        "write",
        &path,
        "--stdin",
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return WindResult {
                ok: false,
                stdout: String::new(),
                stderr: format!("Failed to spawn wind-cli: {}", e),
                exit_code: 1,
                data: None,
            }
        }
    };

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(content.as_bytes());
    } else {
        let _ = child.kill();
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: "Failed to open stdin pipe to wind-cli".to_string(),
            exit_code: 1,
            data: None,
        };
    }

    match child.wait_with_output() {
        Ok(o) => crate::wind::build_wind_result(Ok(o)),
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("Failed waiting for wind-cli: {}", e),
            exit_code: 1,
            data: None,
        },
    }
}

/// L2: write a workspace artifact at a relative path. The runtime
/// orchestrator (src/runtime/tauri-adapter.js:16) and the frontend
/// save UI (index.html:99) both call this. Equivalent to `write_file`
/// today; kept as a separate handler so callers can evolve the
/// artifact-saving semantics (e.g. add a header, run an ingest hook)
/// without touching the primitive.
#[tauri::command]
fn write_workspace_artifact(relative_path: String, content: String) -> WindResult {
    write_file(relative_path, content)
}

/// L2: send a message to an OpenAI-compatible LLM API. Returns the
/// model's text response plus empty command lists (tool execution is
/// handled by the orchestrator on the JS side, not here). v0.2.29
/// minimum: just deliver the chat text; we do not implement tool
/// calling in Rust.
#[tauri::command]
async fn ai_chat(
    message: String,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": message }],
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("http client build: {}", e))?;

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("http send: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("http read: {}", e))?;

    if !status.is_success() {
        return Err(format!("LLM API HTTP {}: {}", status, text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("LLM JSON parse: {}", e))?;

    let response_text = parsed
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    Ok(serde_json::json!({
        "response": response_text,
        "commands_executed": [],
        "command_results": [],
        "model": model,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ensure default config exists before starting the app
    let _ = crate::state::ensure_default_config();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Bridge commands
            run_command,
            run_command_with_stdin,
            do_upgrade,
            check_upgrade,
            get_upgrade_progress,
            read_file,
            list_files,
            select_folder,
            get_workspace_path,
            set_workspace_path,
            get_wiki_path,
            get_winwork_version,
            get_environment_status,
            check_windcli,
            wiki_status,
            save_state,
            load_state,
            load_config,
            save_config,
            // Utility
            open_url,
            get_winwork_root,
            ensure_workspace_dir,
            list_workspaces,
            delete_workspace,
            save_chat_history,
            load_chat_history,
            init_default_files,
            // v0.2.29 must-fix (A group) — see spec §3.1
            check_llm_wiki,
            trigger_install,
            list_workspace,
            list_wiki,
            write_file,
            write_workspace_artifact,
            ai_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}