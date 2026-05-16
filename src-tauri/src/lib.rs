use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Stdio};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindTool {
    pub name: String,
    pub description: String,
    pub risk_level: String,
}

fn find_windcli() -> Option<String> {
    // Try common binary names
    for name in &["windcli", "wind"] {
        if std::process::Command::new(name)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Some(name.to_string());
        }
    }
    None
}

fn get_windcli_path() -> String {
    find_windcli().unwrap_or_else(|| "windcli".to_string())
}

fn run_wind(args: &[&str]) -> WindResult {
    let wind_path = get_windcli_path();
    let output = Command::new(&wind_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let exit_code = out.status.code().unwrap_or(-1);

            let ok = out.status.success();
            let data = if ok && !stdout.trim().is_empty() {
                serde_json::from_str(&stdout).ok()
            } else {
                None
            };

            WindResult {
                ok,
                stdout,
                stderr,
                exit_code,
                data,
            }
        }
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("Failed to execute windcli: {}", e),
            exit_code: -1,
            data: None,
        },
    }
}

/// Run a wind-cli command by passing raw args string
#[tauri::command]
fn run_wind_command(args: String) -> WindResult {
    let parts: Vec<&str> = args.split_whitespace().collect();
    if parts.is_empty() {
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: "No command provided".to_string(),
            exit_code: 1,
            data: None,
        };
    }
    run_wind(&parts)
}

/// List available wind-cli tools
#[tauri::command]
fn list_tools() -> Vec<WindTool> {
    vec![
        WindTool {
            name: "ls".to_string(),
            description: "List directory contents".to_string(),
            risk_level: "None".to_string(),
        },
        WindTool {
            name: "read".to_string(),
            description: "Read file (≤10MB)".to_string(),
            risk_level: "Low".to_string(),
        },
        WindTool {
            name: "write".to_string(),
            description: "Write file via stdin".to_string(),
            risk_level: "Medium".to_string(),
        },
        WindTool {
            name: "mkdir".to_string(),
            description: "Create directory".to_string(),
            risk_level: "Medium".to_string(),
        },
        WindTool {
            name: "rm".to_string(),
            description: "Delete file or directory".to_string(),
            risk_level: "High".to_string(),
        },
        WindTool {
            name: "extract".to_string(),
            description: "Parse document content".to_string(),
            risk_level: "Low".to_string(),
        },
        WindTool {
            name: "wft".to_string(),
            description: "Dispatch windlocal action to WFT".to_string(),
            risk_level: "None".to_string(),
        },
        WindTool {
            name: "workspace_info".to_string(),
            description: "Get current workspace root".to_string(),
            risk_level: "None".to_string(),
        },
        WindTool {
            name: "version_check".to_string(),
            description: "Get version info".to_string(),
            risk_level: "None".to_string(),
        },
    ]
}

/// Get wind-cli version
#[tauri::command]
fn get_version() -> WindResult {
    run_wind(&["--version"])
}

/// Get workspace path from config or temp
#[tauri::command]
fn get_workspace_path() -> String {
    // Use temp dir for demo workspace
    let temp = std::env::temp_dir();
    let demo_dir = temp.join("wind-demo");
    demo_dir.to_string_lossy().to_string()
}

/// Initialize demo workspace
#[tauri::command]
fn init_demo_workspace() -> WindResult {
    let workspace = get_workspace_path();
    // Create directory if needed
    let _ = std::fs::create_dir_all(&workspace);
    run_wind(&["init", &workspace])
}

/// Get directory listing
#[tauri::command]
fn list_workspace() -> WindResult {
    let workspace = get_workspace_path();
    run_wind(&["ls", &workspace])
}

/// Check if wind-cli is installed
#[tauri::command]
fn check_windcli() -> HashMap<String, String> {
    let mut result = HashMap::new();
    if let Some(path) = find_windcli() {
        result.insert("found".to_string(), "true".to_string());
        result.insert("path".to_string(), path);
    } else {
        result.insert("found".to_string(), "false".to_string());
        result.insert(
            "install_url".to_string(),
            "https://github.com/wbyanclaw/wind-cli/releases/latest".to_string(),
        );
    }
    result
}

/// Check if llm-wiki (wind wiki) is installed
#[tauri::command]
fn check_llm_wiki() -> HashMap<String, String> {
    let mut result = HashMap::new();
    let out = Command::new(get_windcli_path())
        .args(["wiki", "status"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match out {
        Ok(o) => {
            if o.status.success() {
                result.insert("found".to_string(), "true".to_string());
            } else {
                result.insert("found".to_string(), "false".to_string());
            }
        }
        Err(_) => {
            result.insert("found".to_string(), "false".to_string());
        }
    }
    result
}

/// Trigger wind-cli install via PowerShell one-liner
#[tauri::command]
fn trigger_install() -> WindResult {
    let install_script = if cfg!(target_os = "windows") {
        "irm https://github.com/wbyanclaw/wind-cli/releases/latest/download/install.ps1 | iex"
    } else {
        "curl -sSL https://raw.githubusercontent.com/wbyanclaw/wind-cli/main/install.sh | sh"
    };

    WindResult {
        ok: true,
        stdout: install_script.to_string(),
        stderr: String::new(),
        exit_code: 0,
        data: None,
    }
}

/// Get wiki status via `wind wiki status`
#[tauri::command]
fn wiki_status() -> WindResult {
    run_wind(&["wiki", "status"])
}

/// Get wiki lint results via `wind wiki lint`
#[tauri::command]
fn wiki_lint() -> WindResult {
    run_wind(&["wiki", "lint"])
}

/// Read a file from workspace via `wind read <path>`
#[tauri::command]
fn read_file(path: String) -> WindResult {
    run_wind(&["read", &path])
}

/// Get the wiki directory path
#[tauri::command]
fn get_wiki_dir() -> String {
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "wind-cli", "wind") {
        proj_dirs.data_dir().join("wiki").to_string_lossy().to_string()
    } else {
        "~/.local/share/wind/wiki".to_string()
    }
}

/// List wiki directory via `wind wiki status`
#[tauri::command]
fn list_wiki() -> WindResult {
    run_wind(&["wiki", "status"])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_wind_command,
            list_tools,
            get_version,
            get_workspace_path,
            init_demo_workspace,
            list_workspace,
            check_windcli,
            check_llm_wiki,
            trigger_install,
            wiki_status,
            wiki_lint,
            read_file,
            get_wiki_dir,
            list_wiki,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
