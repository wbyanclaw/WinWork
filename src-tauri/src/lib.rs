//! winwork - AI Agent file management powered by wind-cli.
//!
//! Design principle: HTML/JS implements all business logic, Rust is only a bridge.

pub mod commands;
pub mod error;
pub mod state;
pub mod wind;

use crate::commands::shell::{run_command_impl, CommandResult};
use crate::wind::WindResult;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::open_url as opener_open_url;

/// Execute wind-cli command with structured args.
#[tauri::command]
fn run_command(args: Vec<String>) -> CommandResult {
    run_command_impl(args)
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
    crate::wind::get_workspace_path()
}

/// Get wiki path.
#[tauri::command]
fn get_wiki_path() -> String {
    crate::wind::get_wiki_path()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Bridge commands
            run_command,
            read_file,
            list_files,
            select_folder,
            get_workspace_path,
            get_wiki_path,
            save_state,
            load_state,
            // Utility
            open_url,
            get_winwork_root,
            ensure_workspace_dir,
            list_workspaces,
            delete_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}