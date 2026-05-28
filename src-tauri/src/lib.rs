//! winwork - AI Agent file management powered by wind-cli.
//!
//! Design principle: HTML/JS implements all business logic, Rust is only a bridge.

pub mod commands;
pub mod error;
pub mod state;
pub mod wind;

use crate::commands::shell::{run_command_impl, run_command_with_stdin_impl, CommandResult};
use crate::wind::WindResult;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}