//! File operations bridge for wind-cli.

use tauri_plugin_dialog::DialogExt;
use crate::wind::{run_wind, WindResult};

/// Save file content to the workspace.
pub fn save_file(path: String, content: String) -> WindResult {
    // Write content to file via temp file and use wind-cli write command
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("winwork_temp_{}.txt", std::process::id()));

    if let Err(e) = std::fs::write(&temp_file, &content) {
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("Failed to write temp file: {}", e),
            exit_code: 1,
            data: None,
        };
    }

    let result = run_wind(&["write", &path, "--stdin"]);
    // Note: The actual write is handled by the caller writing to stdin
    // For now, return the result of the write command

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_file);

    result
}

/// Read file content from the workspace.
pub fn read_file_impl(path: String) -> WindResult {
    let full_path = if std::path::Path::new(&path).is_absolute() {
        path
    } else {
        let workspace = crate::wind::get_workspace_path();
        let ws = workspace.trim_end_matches('/');
        format!("{}/{}", ws, path)
    };
    run_wind(&["--json", "read", &full_path])
}

/// List files in a directory (or workspace root if no path provided).
pub fn list_files_impl(path: Option<String>) -> WindResult {
    let target_path = path.unwrap_or_else(|| crate::wind::get_workspace_path());
    run_wind(&["--json", "ls", &target_path])
}

/// Open folder selection dialog.
pub async fn select_folder_impl(app: tauri::AppHandle) -> WindResult {
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