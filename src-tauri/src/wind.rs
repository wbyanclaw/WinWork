//! wind-cli execution layer.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command as StdCommand, Stdio};
use which::which;

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

/// Find wind-cli binary path.
/// Checks PATH first, then fallback install locations.
pub fn find_windcli() -> Option<String> {
    // 1. Check PATH for both possible names (windcli first, then wind)
    for name in &["windcli", "wind"] {
        if which(name).is_ok() {
            return Some(name.to_string());
        }
    }

    // 2. Check install fallback paths
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("LOCALAPPDATA") {
            for exe in &["windcli.exe", "wind.exe"] {
                let path = std::path::Path::new(&appdata)
                    .join("winwork")
                    .join("wind-cli")
                    .join(exe);
                if path.exists() {
                    return Some(path.to_string_lossy().into_owned());
                }
            }
        }
        if let Some(appdata) = std::env::var_os("APPDATA") {
            for exe in &["windcli.exe", "wind.exe"] {
                let path = std::path::Path::new(&appdata)
                    .join("winwork")
                    .join("wind-cli")
                    .join(exe);
                if path.exists() {
                    return Some(path.to_string_lossy().into_owned());
                }
            }
        }
        if let Some(appdata) = std::env::var_os("LOCALAPPDATA") {
            for exe in &["windcli.exe", "wind.exe"] {
                let path = std::path::Path::new(&appdata).join("wind-cli").join(exe);
                if path.exists() {
                    let dir = path.parent()?.to_path_buf();
                    let current = std::env::var_os("PATH").unwrap_or_default();
                    let new_path = format!(
                        "{}{}{}",
                        dir.to_string_lossy(),
                        std::path::MAIN_SEPARATOR,
                        current.to_string_lossy()
                    );
                    std::env::set_var("PATH", &new_path);
                    return Some(path.to_string_lossy().into_owned());
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = std::env::var_os("HOME") {
            for name in &["windcli", "wind"] {
                let path = std::path::Path::new(&home)
                    .join(".local")
                    .join("bin")
                    .join(name);
                if path.exists() {
                    return Some(path.to_string_lossy().into_owned());
                }
            }
        }
    }

    None
}

fn get_windcli_path() -> String {
    find_windcli().unwrap_or_else(|| "windcli".to_string())
}

/// Execute wind-cli with given arguments.
pub fn run_wind(args: &[&str]) -> WindResult {
    let wind_path = get_windcli_path();

    if which(&wind_path).is_err() {
        if which("windcli").is_ok() {
            let output = StdCommand::new("windcli")
                .args(args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output();
            return build_wind_result(output);
        }
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: "windcli not found in PATH. Please install wind-cli first.".to_string(),
            exit_code: -1,
            data: None,
        };
    }

    let output = StdCommand::new(&wind_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    build_wind_result(output)
}

fn build_wind_result(output: Result<std::process::Output, std::io::Error>) -> WindResult {
    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let exit_code = out.status.code().unwrap_or(-1);
            let ok = out.status.success();
            let data = if !stdout.trim().is_empty() {
                serde_json::from_str(&stdout).ok()
            } else {
                None
            };
            WindResult { ok, stdout, stderr, exit_code, data }
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

/// Check if wind-cli is installed.
pub fn check_windcli() -> HashMap<String, String> {
    let mut result = HashMap::new();
    if let Some(path) = find_windcli() {
        result.insert("found".to_string(), "true".to_string());
        result.insert("path".to_string(), path.clone());
        let version_out = run_wind(&["--version"]);
        result.insert(
            "version".to_string(),
            if version_out.ok {
                version_out.stdout.trim().to_string()
            } else {
                "unknown".to_string()
            },
        );
    } else {
        result.insert("found".to_string(), "false".to_string());
        result.insert(
            "install_url".to_string(),
            "https://github.com/wbyanclaw/wind-cli/releases/latest".to_string(),
        );
    }
    result
}

/// List available wind-cli tools.
pub fn list_tools() -> Vec<WindTool> {
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

/// Get wind root directory: ~/.local/share/wind/
pub fn get_wind_root() -> std::path::PathBuf {
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "wind-cli", "wind") {
        proj_dirs.data_dir().to_path_buf()
    } else if let Some(home) = std::env::var_os("HOME") {
        std::path::Path::new(&home).join(".local").join("share").join("wind")
    } else {
        std::env::temp_dir().join("wind")
    }
}

/// Get workspace path: ~/.local/share/wind/workspace/
pub fn get_workspace_path() -> String {
    if let Ok(winwork_root) = super::state::winwork_root() {
        let ws_path = winwork_root.join("current_workspace.txt");
        if let Ok(content) = std::fs::read_to_string(&ws_path) {
            let path = std::path::PathBuf::from(content.trim());
            if path.exists() {
                return path.to_string_lossy().into_owned();
            }
        }
    }
    get_wind_root().join("workspace").to_string_lossy().into_owned()
}

/// Get wiki path: ~/.local/share/wind/wiki/
pub fn get_workspace_wiki_path() -> String {
    get_wind_root().join("wiki").to_string_lossy().into_owned()
}

/// Get wiki directory path.
pub fn get_wiki_dir() -> String {
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "wind-cli", "wind") {
        proj_dirs.data_dir().join("wiki").to_string_lossy().into_owned()
    } else {
        "~/.local/share/wind/wiki".to_string()
    }
}

/// Check if llm-wiki is available.
pub fn check_llm_wiki() -> HashMap<String, String> {
    let mut result = HashMap::new();
    let windcli_path = get_windcli_path();

    let found_path = if std::path::Path::new(&windcli_path).is_absolute() {
        if std::path::Path::new(&windcli_path).exists() {
            Some(windcli_path.clone())
        } else {
            None
        }
    } else if which(&windcli_path).is_ok() {
        Some(windcli_path)
    } else if which("windcli").is_ok() {
        Some("windcli".to_string())
    } else {
        None
    };

    let Some(windcli) = found_path else {
        result.insert("found".to_string(), "false".to_string());
        result.insert("reason".to_string(), "wind-cli not found".to_string());
        return result;
    };

    let out = StdCommand::new(&windcli)
        .args(["wiki", "status"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match out {
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            if stderr.contains("unrecognized subcommand") || stderr.contains("unknown subcommand") {
                result.insert("found".to_string(), "false".to_string());
                result.insert(
                    "reason".to_string(),
                    "当前 wind-cli 版本不支持 wiki 子命令".to_string(),
                );
            } else if o.status.success() {
                result.insert("found".to_string(), "true".to_string());
            } else {
                result.insert("found".to_string(), "false".to_string());
                if !stderr.is_empty() {
                    result.insert("reason".to_string(), stderr.to_string());
                }
            }
        }
        Err(e) => {
            result.insert("found".to_string(), "false".to_string());
            result.insert("reason".to_string(), format!("wind-cli error: {}", e));
        }
    }
    result
}

/// Check for wind-cli upgrades via `wind upgrade --check`
pub fn check_upgrade() -> HashMap<String, String> {
    let mut result = HashMap::new();

    let windcli = match find_windcli() {
        Some(p) => p,
        None => {
            result.insert("found".to_string(), "false".to_string());
            result.insert("reason".to_string(), "wind-cli not found".to_string());
            return result;
        }
    };

    let output = StdCommand::new(&windcli)
        .args(["upgrade", "--check"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();

            // Check for update by looking for keywords in output
            let has_update = stdout.to_lowercase().contains("update")
                || stdout.to_lowercase().contains("newer")
                || stdout.to_lowercase().contains("available")
                || stdout.to_lowercase().contains("upgrade");

            // Parse version from output (e.g., "v0.1.10" or "current: 0.1.10, latest: 0.1.11")
            let mut current_version = String::new();
            let mut latest_version = String::new();

            // Try to extract versions from output
            // Pattern: looking for version numbers like 0.1.x or v0.x.x
            for line in stdout.lines() {
                let line_lower = line.to_lowercase();
                if line_lower.contains("current") || line_lower.contains("your") {
                    // Try to extract version number
                    if let Some(caps) = regex::Regex::new(r"v?(\d+\.\d+\.\d+)").ok().and_then(|r| r.captures(line)) {
                        if current_version.is_empty() {
                            current_version = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
                        }
                    }
                }
                if line_lower.contains("latest") || line_lower.contains("new") {
                    if let Some(caps) = regex::Regex::new(r"v?(\d+\.\d+\.\d+)").ok().and_then(|r| r.captures(line)) {
                        if latest_version.is_empty() {
                            latest_version = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
                        }
                    }
                }
            }

            // If versions still empty, try single version pattern
            if current_version.is_empty() && latest_version.is_empty() {
                if let Some(caps) = regex::Regex::new(r"(\d+\.\d+\.\d+)").ok().and_then(|r| r.find(&stdout)) {
                    if has_update {
                        latest_version = caps.as_str().to_string();
                    } else {
                        current_version = caps.as_str().to_string();
                    }
                }
            }

            result.insert("found".to_string(), "true".to_string());
            result.insert("has_update".to_string(), if has_update { "true" } else { "false" }.to_string());
            result.insert("output".to_string(), stdout);
            result.insert("error".to_string(), stderr);
            if !current_version.is_empty() {
                result.insert("current_version".to_string(), current_version);
            }
            if !latest_version.is_empty() {
                result.insert("latest_version".to_string(), latest_version);
            }
            result.insert(
                "url".to_string(),
                "https://github.com/wbyanclaw/wind-cli/releases/latest".to_string(),
            );
        }
        Err(e) => {
            result.insert("found".to_string(), "false".to_string());
            result.insert("reason".to_string(), format!("Failed to check upgrade: {}", e));
        }
    }
    result
}

/// Trigger wind-cli self-upgrade via `wind upgrade`
pub fn do_upgrade() -> WindResult {
    let windcli = match find_windcli() {
        Some(p) => p,
        None => {
            return WindResult {
                ok: false,
                stdout: String::new(),
                stderr: "wind-cli not found".to_string(),
                exit_code: -1,
                data: None,
            };
        }
    };

    let output = StdCommand::new(&windcli)
        .args(["upgrade"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    build_wind_result(output)
}