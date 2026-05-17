use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command as StdCommand, Stdio};
use tauri_plugin_opener::open_url as opener_open_url;
use which::which;

mod minimax;
use minimax::{ChatMessage, MiniMaxClient};

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

/// Fast PATH lookup for wind-cli binary (named `wind` or `windcli` depending on install method).
/// Also checks fallback install paths used by trigger_install().
fn find_windcli() -> Option<String> {
    // 1. Check PATH for both possible names (windcli first, then wind)
    for name in &["windcli", "wind"] {
        if which(name).is_ok() {
            return Some(name.to_string());
        }
    }

    // 2. Check install fallback paths (both windcli and wind names)
    #[cfg(target_os = "windows")]
    {
        // Try LOCALAPPDATA\winwork\wind-cli\ (backend install path)
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
        // Try APPDATA\winwork\wind-cli\ (fallback on some Windows configs)
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
        // Try LOCALAPPDATA\wind-cli\ (install.ps1 path — add to PATH)
        if let Some(appdata) = std::env::var_os("LOCALAPPDATA") {
            for exe in &["windcli.exe", "wind.exe"] {
                let path = std::path::Path::new(&appdata).join("wind-cli").join(exe);
                if path.exists() {
                    // Found at install.ps1 path — add dir to PATH for this session
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
        // Check ~/.local/bin/ (standard Unix install location)
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

fn run_wind(args: &[&str]) -> WindResult {
    let wind_path = get_windcli_path();

    // Check if the resolved binary actually exists before trying to run
    let exe_to_check = if std::path::Path::new(&wind_path).is_absolute() {
        &wind_path
    } else {
        &wind_path
    };
    if which(exe_to_check).is_err() {
        // Try "windcli" as fallback in PATH
        if which("windcli").is_ok() {
            // PATH has windcli — use it directly (let the OS resolve it)
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
            let data = if ok && !stdout.trim().is_empty() {
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

/// Run a wind-cli command with structured args (no shell injection risk).
/// Accepts a Vec<String> so paths with spaces are handled correctly.
/// Handles 'ls' specially by prepending the workspace path.
#[tauri::command]
fn run_wind_command(args: Vec<String>) -> WindResult {
    if args.is_empty() {
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: "No command provided".to_string(),
            exit_code: 1,
            data: None,
        };
    }

    // Handle ls command specially - prepend workspace path
    let first_arg = args[0].to_lowercase();
    if first_arg == "ls" {
        let workspace = get_workspace_path();
        let mut ls_args: Vec<&str> = vec!["--json", "ls", &workspace];
        // Add remaining args
        for arg in args.iter().skip(1) {
            ls_args.push(arg);
        }
        return run_wind(&ls_args);
    }

    // Convert Vec<String> to Vec<&str> slices for run_wind
    let parts: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_wind(&parts)
}

/// List available wind-cli tools
#[tauri::command]
fn list_tools() -> Vec<WindTool> {
    vec![
        WindTool { name: "ls".to_string(), description: "List directory contents".to_string(), risk_level: "None".to_string() },
        WindTool { name: "read".to_string(), description: "Read file (≤10MB)".to_string(), risk_level: "Low".to_string() },
        WindTool { name: "write".to_string(), description: "Write file via stdin".to_string(), risk_level: "Medium".to_string() },
        WindTool { name: "mkdir".to_string(), description: "Create directory".to_string(), risk_level: "Medium".to_string() },
        WindTool { name: "rm".to_string(), description: "Delete file or directory".to_string(), risk_level: "High".to_string() },
        WindTool { name: "extract".to_string(), description: "Parse document content".to_string(), risk_level: "Low".to_string() },
        WindTool { name: "wft".to_string(), description: "Dispatch windlocal action to WFT".to_string(), risk_level: "None".to_string() },
        WindTool { name: "workspace_info".to_string(), description: "Get current workspace root".to_string(), risk_level: "None".to_string() },
        WindTool { name: "version_check".to_string(), description: "Get version info".to_string(), risk_level: "None".to_string() },
    ]
}

/// Get wind-cli version
#[tauri::command]
fn get_version() -> WindResult {
    run_wind(&["--version"])
}

/// Get workspace path using proper directory structure:
/// ~/.local/share/wind/workspace/
/// ~/.local/share/wind/wiki/
fn get_wind_root() -> std::path::PathBuf {
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "wind-cli", "wind") {
        proj_dirs.data_dir().to_path_buf()
    } else if let Some(home) = std::env::var_os("HOME") {
        std::path::Path::new(&home).join(".local").join("share").join("wind")
    } else {
        std::env::temp_dir().join("wind")
    }
}

/// Get workspace path from winwork state or proper fallback
#[tauri::command]
fn get_workspace_path() -> String {
    // First try to load from winwork state
    if let Ok(winwork_root) = winwork_root() {
        let ws_path = winwork_root.join("current_workspace.txt");
        if let Ok(content) = std::fs::read_to_string(&ws_path) {
            let path = std::path::PathBuf::from(content.trim());
            if path.exists() {
                return path.to_string_lossy().into_owned();
            }
        }
    }
    // Use proper directory structure: ~/.local/share/wind/workspace/
    get_wind_root().join("workspace").to_string_lossy().into_owned()
}

/// Get wiki directory path
#[tauri::command]
fn get_workspace_wiki_path() -> String {
    get_wind_root().join("wiki").to_string_lossy().into_owned()
}

/// Initialize demo workspace with proper directory structure:
/// ~/.local/share/wind/workspace/
/// ~/.local/share/wind/wiki/
#[tauri::command]
fn init_demo_workspace() -> WindResult {
    let workspace = get_workspace_path();
    let wiki = get_workspace_wiki_path();

    // Create workspace directory
    let _ = std::fs::create_dir_all(&workspace);

    // Create wiki directory
    let _ = std::fs::create_dir_all(&wiki);

    // Save workspace path to winwork state so wind-cli uses it
    if let Ok(winwork_root) = winwork_root() {
        if let Some(parent) = winwork_root.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let ws_path = winwork_root.join("current_workspace.txt");
        let _ = std::fs::write(&ws_path, &workspace);
    }

    // Initialize with wind-cli (this sets up wind config with the workspace root)
    let result = run_wind(&["init", &workspace]);

    if result.ok {
        WindResult {
            ok: true,
            stdout: format!("工作区初始化成功:\n  workspace: {}\n  wiki: {}", workspace, wiki),
            stderr: result.stderr,
            exit_code: result.exit_code,
            data: result.data,
        }
    } else {
        result
    }
}

/// List directory listing (JSON format)
/// Note: --json is a GLOBAL flag, must come before the subcommand (not after).
#[tauri::command]
fn list_workspace() -> WindResult {
    let workspace = get_workspace_path();
    run_wind(&["--json", "ls", &workspace])
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

/// Check if llm-wiki is available by running `wind wiki status`
#[tauri::command]
fn check_llm_wiki() -> HashMap<String, String> {
    let mut result = HashMap::new();

    // First check if we can find wind-cli
    let windcli_path = get_windcli_path();

    // Try to find wind-cli (absolute path or bare name)
    let found_path = if std::path::Path::new(&windcli_path).is_absolute() {
        if std::path::Path::new(&windcli_path).exists() {
            Some(windcli_path.clone())
        } else {
            None
        }
    } else {
        // Try bare name in PATH
        if which(&windcli_path).is_ok() {
            Some(windcli_path)
        } else if which("windcli").is_ok() {
            Some("windcli".to_string())
        } else {
            None
        }
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
            // Check for "unrecognized subcommand 'wiki'" which means wiki is not supported
            if stderr.contains("unrecognized subcommand") || stderr.contains("unknown subcommand") {
                result.insert("found".to_string(), "false".to_string());
                result.insert("reason".to_string(), "当前 wind-cli 版本不支持 wiki 子命令".to_string());
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

/// Open a URL in the default browser
#[tauri::command]
fn open_url(url: String) -> WindResult {
    let result = opener_open_url(&url, None::<&str>);
    match result {
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

/// Install wind-cli: download from GitHub releases to local install directory.
/// On Windows, also updates the session PATH so the binary is found immediately.
#[tauri::command]
async fn trigger_install() -> WindResult {
    use std::process::Command as StdCommand;

    #[cfg(target_os = "windows")]
    let install_dir = std::path::PathBuf::from(
        std::env::var("LOCALAPPDATA")
            .unwrap_or_else(|_| std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string()))
    )
    .join("wind-cli");

    #[cfg(not(target_os = "windows"))]
    let install_dir = std::path::PathBuf::from(
        std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
    )
    .join(".local")
    .join("bin");

    #[cfg(target_os = "windows")]
    let (download_url, dest) = {
        let exe = install_dir.join("windcli.exe");
        (
            "https://github.com/wbyanclaw/wind-cli/releases/latest/download/windcli.exe".to_string(),
            exe,
        )
    };

    #[cfg(not(target_os = "windows"))]
    let (download_url, dest) = {
        let exe = install_dir.join("windcli");
        (
            "https://github.com/wbyanclaw/wind-cli/releases/latest/download/windcli".to_string(),
            exe,
        )
    };

    // Create install directory
    if let Err(e) = std::fs::create_dir_all(&install_dir) {
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("无法创建安装目录: {}: {}", install_dir.display(), e),
            exit_code: 1,
            data: None,
        };
    }

    // Download binary via curl
    let output = StdCommand::new("curl")
        .args(["-L", "-o", &dest.to_string_lossy(), &download_url])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            // Make executable on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&dest, PermissionsExt::from_mode(0o755));
            }

            // On Windows, add install dir to session PATH so it is found immediately
            #[cfg(target_os = "windows")]
            {
                let current = std::env::var_os("PATH").unwrap_or_default();
                let new_path = format!(
                    "{}{}{}",
                    install_dir.to_string_lossy(),
                    std::path::MAIN_SEPARATOR,
                    current.to_string_lossy()
                );
                std::env::set_var("PATH", &new_path);
            }

            WindResult {
                ok: true,
                stdout: format!(
                    "wind-cli 安装成功: {}\n重启应用后即可使用",
                    dest.to_string_lossy()
                ),
                stderr: String::new(),
                exit_code: 0,
                data: None,
            }
        }
        Ok(out) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!(
                "下载失败 (curl exit {}): {}",
                out.status,
                String::from_utf8_lossy(&out.stderr)
            ),
            exit_code: 1,
            data: None,
        },
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("无法执行 curl: {}\n请确保已安装 curl", e),
            exit_code: 1,
            data: None,
        },
    }
}

/// Get wiki status via `wind --json wiki status`
#[tauri::command]
fn wiki_status() -> WindResult {
    run_wind(&["--json", "wiki", "status"])
}

/// Get wiki lint results via `wind --json wiki lint`
#[tauri::command]
fn wiki_lint() -> WindResult {
    run_wind(&["--json", "wiki", "lint"])
}

/// Create a directory via `wind mkdir <path>` with typed parameter (no regex parsing).
#[tauri::command]
fn mkdir_dir(path: String) -> WindResult {
    run_wind(&["mkdir", &path])
}

/// Open a file via `wind wft file <path>` with typed parameter (no regex parsing).
#[tauri::command]
fn wft_open(file: String) -> WindResult {
    run_wind(&["wft", "file", &file])
}

/// Ingest a file into the wiki via `wind --json wiki ingest <path>`
#[tauri::command]
fn wiki_ingest(path: String) -> WindResult {
    run_wind(&["--json", "wiki", "ingest", &path])
}

/// Query the wiki via `wind --json wiki query <question>`
#[tauri::command]
fn wiki_query(question: String) -> WindResult {
    run_wind(&["--json", "wiki", "query", &question])
}

/// Read a file from workspace via `wind --json read <path>`
/// Handles both absolute paths and workspace-relative paths.
#[tauri::command]
fn read_file(path: String) -> WindResult {
    let full_path = if std::path::Path::new(&path).is_absolute() {
        path
    } else {
        let workspace = get_workspace_path();
        // Join workspace with relative path, handling trailing slashes
        let ws = workspace.trim_end_matches('/');
        format!("{}/{}", ws, path)
    };
    run_wind(&["--json", "read", &full_path])
}

/// Get the wiki directory path
#[tauri::command]
fn get_wiki_dir() -> String {
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "wind-cli", "wind") {
        proj_dirs.data_dir().join("wiki").to_string_lossy().into_owned()
    } else {
        "~/.local/share/wind/wiki".to_string()
    }
}

/// List wiki directory via `wind --json wiki status`
#[tauri::command]
fn list_wiki() -> WindResult {
    run_wind(&["--json", "wiki", "status"])
}

/// AI Chat result
#[derive(Debug, Serialize, Deserialize)]
pub struct AiChatResult {
    pub ok: bool,
    pub response: String,
    pub commands_executed: Vec<String>,
    pub command_results: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// System prompt for AI assistant
fn get_system_prompt() -> String {
    r#"You are winwork, an AI assistant that helps users manage files using wind-cli commands.

Available wind-cli commands:
- ls [path]: List directory contents
- read <file>: Read file content (≤10MB)
- write <file> --stdin: Write file content
- mkdir <path>: Create directory
- rm <path> [--force]: Delete file or directory
- wiki status: Show LLM Wiki status
- wiki lint: Lint LLM Wiki
- version: Show wind-cli version
- init <path>: Initialize workspace

Workspace is isolated — use the current workspace path from context.

When user asks to perform file operations:
1. Execute the appropriate wind-cli command
2. Report the result clearly in Chinese
3. Be helpful and concise

Example interactions:
User: 列出当前目录的文件
You: I'll list the files in your workspace.

[Executes: wind ls <current_workspace>]
Result: Shows the directory listing

User: 创建一个新文件夹叫test
You: I'll create a directory called "test" for you.

[Executes: wind mkdir test]
Result: Directory created successfully

Always wrap commands in [Executes: ...] format."#.to_string()
}

/// AI Chat - understand user intent and execute wind-cli commands
#[tauri::command]
async fn ai_chat(
    message: String,
    api_key: String,
    base_url: Option<String>,
    model: Option<String>,
) -> Result<AiChatResult, String> {
    let client = MiniMaxClient::new(api_key, base_url.unwrap_or_default(), model);
    let workspace = get_workspace_path();

    let system_msg = format!(
        "{}\n\nCurrent workspace: {}",
        get_system_prompt(),
        workspace
    );

    let messages = vec![
        ChatMessage { role: "system".to_string(), content: system_msg },
        ChatMessage { role: "user".to_string(), content: message },
    ];

    let response = client.chat(messages).await.map_err(|e| e.to_string())?;

    let response_text = response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    let mut commands_executed = Vec::new();
    let mut command_results = Vec::new();

    for line in response_text.lines() {
        if line.trim().starts_with("[Executes:") {
            if let Some(cmd) = line.trim().strip_prefix("[Executes:") {
                let cmd = cmd.trim_end_matches(']').trim();
                commands_executed.push(cmd.to_string());
                // Split on whitespace so "wind mkdir path" → ["wind", "mkdir", "path"]
                let parts: Vec<String> = cmd.split_whitespace().map(String::from).collect();
                let result = run_wind_command(parts);
                command_results.push(serde_json::json!({
                    "command": cmd,
                    "ok": result.ok,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.exit_code,
                    "data": result.data,
                }));
            }
        }
    }

    Ok(AiChatResult {
        ok: true,
        response: response_text,
        commands_executed,
        command_results,
        error: None,
    })
}

/// Get API config info
#[tauri::command]
fn get_api_config() -> serde_json::Value {
    serde_json::json!({
        "default_model": "MiniMax-M2.7-highspeed",
        "base_url": "https://df.dawnloadai.com:9888/v1"
    })
}

// ============================================================================
// State Persistence — winwork v0.2
// Storage: ~/.winwork/ via directories crate
// Layout:
//   ~/.winwork/
//   ├── state.json              # global: active workspace, app preferences
//   └── workspaces/
//       └── <name>/
//           ├── chat.json       # chat history
//           ├── tree_state.json # file tree expansion state
//           └── settings.json   # workspace-level settings
// ============================================================================

/// Resolve the winwork root directory (~/.winwork/)
fn winwork_root() -> Result<std::path::PathBuf, String> {
    directories::ProjectDirs::from("com", "winwork", "winwork")
        .map(|d| d.data_dir().to_path_buf())
        .ok_or_else(|| "Failed to resolve winwork data directory".to_string())
}

/// Resolve a path relative to the winwork root
fn winwork_path(relative: &str) -> Result<std::path::PathBuf, String> {
    Ok(winwork_root()?.join(relative))
}

/// Write JSON data to a file in the winwork directory.
#[tauri::command]
fn save_state(relative_path: String, data: serde_json::Value) -> Result<(), String> {
    let path = winwork_path(&relative_path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;
    Ok(())
}

/// Read JSON data from a file in the winwork directory.
/// Returns null JSON value if the file does not exist (not an error).
#[tauri::command]
fn load_state(relative_path: String) -> Result<serde_json::Value, String> {
    let path = winwork_path(&relative_path)?;
    let json_str = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(serde_json::Value::Null);
        }
        Err(e) => return Err(format!("Failed to read {}: {}", path.display(), e)),
    };
    serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

/// Ensure a workspace directory exists and return its path.
#[tauri::command]
fn ensure_workspace_dir(name: String) -> Result<String, String> {
    let path = winwork_path("workspaces")?.join(&name);
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create workspace '{}': {}", name, e))?;
    Ok(path.to_string_lossy().into_owned())
}

/// List all workspace names.
#[tauri::command]
fn list_workspaces() -> Result<Vec<String>, String> {
    let workspaces_path = winwork_path("workspaces")?;
    if !workspaces_path.exists() {
        return Ok(vec![]);
    }
    let mut names: Vec<String> = std::fs::read_dir(&workspaces_path)
        .map_err(|e| format!("Failed to read workspaces directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect();
    names.sort();
    Ok(names)
}

/// Delete a workspace by name. Fails if it is the last remaining workspace.
#[tauri::command]
fn delete_workspace(name: String) -> Result<(), String> {
    let state_path = winwork_path("state.json")?;
    let state: serde_json::Value = if state_path.exists() {
        let s = std::fs::read_to_string(&state_path)
            .map_err(|e| format!("Failed to read state: {}", e))?;
        serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)
    } else {
        serde_json::Value::Null
    };

    let active = state
        .get("activeWorkspace")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let all = list_workspaces()?;
    if all.len() <= 1 && all.first() == Some(&name) {
        return Err("Cannot delete the last workspace".to_string());
    }

    let workspace_path = winwork_path("workspaces")?.join(&name);
    if !workspace_path.exists() {
        return Err(format!("Workspace '{}' does not exist", name));
    }

    std::fs::remove_dir_all(&workspace_path)
        .map_err(|e| format!("Failed to delete workspace '{}': {}", name, e))?;

    if name == active {
        let remaining = list_workspaces()?;
        if let Some(first) = remaining.first() {
            let new_state = serde_json::json!({ "activeWorkspace": first });
            let _ = std::fs::write(&state_path, serde_json::to_string_pretty(&new_state).unwrap_or_default());
        }
    }

    Ok(())
}

/// Get the winwork root directory path (for frontend use)
#[tauri::command]
fn get_winwork_root() -> String {
    winwork_root()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "~/.winwork".to_string())
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
            get_workspace_wiki_path,
            init_demo_workspace,
            list_workspace,
            check_windcli,
            check_llm_wiki,
            open_url,
            trigger_install,
            wiki_status,
            wiki_lint,
            mkdir_dir,
            wft_open,
            wiki_ingest,
            wiki_query,
            read_file,
            get_wiki_dir,
            list_wiki,
            ai_chat,
            get_api_config,
            save_state,
            load_state,
            ensure_workspace_dir,
            list_workspaces,
            delete_workspace,
            get_winwork_root,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
