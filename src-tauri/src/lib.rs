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

/// Fast PATH lookup for windcli — no subprocess spawning, returns instantly
fn find_windcli() -> Option<String> {
    for name in &["windcli", "wind"] {
        if which(name).is_ok() {
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
    let output = StdCommand::new(&wind_path)
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
    let out = StdCommand::new(get_windcli_path())
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

/// Install wind-cli: open download URL in browser, return immediately so frontend can poll
#[tauri::command]
fn trigger_install() -> WindResult {
    let download_url = "https://github.com/wbyanclaw/wind-cli/releases/download/v0.2.1/windcli.exe";
    // Open download in default browser — the browser will handle the download
    match opener_open_url(download_url, None::<&str>) {
        Ok(_) => WindResult {
            ok: true,
            stdout: "下载已在浏览器中开始，请在浏览器下载完成后，双击运行 windcli.exe 进行安装。".to_string(),
            stderr: String::new(),
            exit_code: 0,
            data: None,
        },
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("无法打开下载链接: {}", e),
            exit_code: -1,
            data: None,
        },
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
    r#"You are WinWork, an AI assistant that helps users manage files using wind-cli commands.

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

Workspace is isolated at ~/.local/share/wind/workspace/

When user asks to perform file operations, you should:
1. Execute the appropriate wind-cli command
2. Report the result clearly in Chinese
3. Be helpful and concise

Example interactions:
User: 列出当前目录的文件
You: I'll list the files in your workspace.

[Executes: wind ls ~/.local/share/wind/workspace/]
Result: Shows the directory listing

User: 创建一个新文件夹叫test
You: I'll create a directory called "test" for you.

[Executes: wind mkdir test]
Result: Directory created successfully

Always wrap commands in [Executes: ...] format and results in [Result: ...] format."#.to_string()
}

/// AI Chat - understand user intent and execute wind-cli commands
#[tauri::command]
async fn ai_chat(
    message: String,
    api_key: String,
    model: Option<String>,
) -> Result<AiChatResult, String> {
    let client = MiniMaxClient::new(api_key, model);

    let workspace = get_workspace_path();

    // Build messages with system prompt
    let system_msg = format!(
        "{}\n\nCurrent workspace: {}",
        get_system_prompt(),
        workspace
    );

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_msg,
        },
        ChatMessage {
            role: "user".to_string(),
            content: message,
        },
    ];

    // Call MiniMax API
    let response = client.chat(messages).await.map_err(|e| e.to_string())?;

    // Extract response content
    let response_text = response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    // Parse and execute commands from response
    let mut commands_executed = Vec::new();
    let mut command_results = Vec::new();

    // Extract commands from [Executes: ...] format
    for line in response_text.lines() {
        if line.trim().starts_with("[Executes:") {
            if let Some(cmd) = line.trim().strip_prefix("[Executes:") {
                let cmd = cmd.trim_end_matches(']').trim();
                commands_executed.push(cmd.to_string());

                // Execute the command
                let result = run_wind_command(cmd.to_string());
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

/// Get API config info (returns a placeholder - actual key should be stored securely)
#[tauri::command]
fn get_api_config() -> serde_json::Value {
    serde_json::json!({
        "default_model": "MiniMax-M2.7-highspeed",
        "base_url": "https://df.dawnloadai.com:9888/v1"
    })
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
            open_url,
            trigger_install,
            wiki_status,
            wiki_lint,
            read_file,
            get_wiki_dir,
            list_wiki,
            ai_chat,
            get_api_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
