//! winwork - AI Agent file management powered by wind-cli.

pub mod chat;
pub mod state;
pub mod wind;

use std::collections::HashMap;
use std::process::Command as StdCommand;
use tauri_plugin_opener::open_url as opener_open_url;

use chat::{ChatClient, ChatMessage};
use state::{load_state, save_state};
use wind::{run_wind, WindResult};

/// Run a wind-cli command with structured args.
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

    let first_arg = args[0].to_lowercase();
    if first_arg == "ls" {
        let workspace = wind::get_workspace_path();
        let mut ls_args: Vec<&str> = vec!["--json", "ls", &workspace];
        for arg in args.iter().skip(1) {
            ls_args.push(arg);
        }
        eprintln!("[DIAGNOSTIC] run_wind_command: wind {}", ls_args.join(" "));
        return run_wind(&ls_args);
    }

    let parts: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[DIAGNOSTIC] run_wind_command: wind {}", parts.join(" "));
    run_wind(&parts)
}

#[tauri::command]
fn list_tools() -> Vec<wind::WindTool> {
    wind::list_tools()
}

#[tauri::command]
fn get_version() -> WindResult {
    eprintln!("[DIAGNOSTIC] get_version called");
    run_wind(&["--version"])
}

#[tauri::command]
fn get_winwork_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_workspace_path() -> String {
    wind::get_workspace_path()
}

#[tauri::command]
fn get_workspace_wiki_path() -> String {
    wind::get_workspace_wiki_path()
}

#[tauri::command]
fn init_demo_workspace() -> WindResult {
    let workspace = wind::get_workspace_path();
    let wiki = wind::get_workspace_wiki_path();

    eprintln!("[DIAGNOSTIC] init_demo_workspace: workspace={}, wiki={}", workspace, wiki);

    let _ = std::fs::create_dir_all(&workspace);
    let _ = std::fs::create_dir_all(&wiki);

    if let Ok(winwork_root) = state::winwork_root() {
        if let Some(parent) = winwork_root.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let ws_path = winwork_root.join("current_workspace.txt");
        let _ = std::fs::write(&ws_path, &workspace);
    }

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

#[tauri::command]
fn list_workspace() -> WindResult {
    let workspace = wind::get_workspace_path();
    run_wind(&["--json", "ls", &workspace])
}

#[tauri::command]
fn check_windcli() -> HashMap<String, String> {
    wind::check_windcli()
}

#[tauri::command]
fn check_llm_wiki() -> HashMap<String, String> {
    wind::check_llm_wiki()
}

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

#[tauri::command]
async fn trigger_install() -> WindResult {
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

    if let Err(e) = std::fs::create_dir_all(&install_dir) {
        return WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("无法创建安装目录: {}: {}", install_dir.display(), e),
            exit_code: 1,
            data: None,
        };
    }

    let output = StdCommand::new("curl")
        .args(["-L", "-o", &dest.to_string_lossy(), &download_url])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&dest, PermissionsExt::from_mode(0o755));
            }

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
                stdout: format!("wind-cli 安装成功: {}\n重启应用后即可使用", dest.to_string_lossy()),
                stderr: String::new(),
                exit_code: 0,
                data: None,
            }
        }
        Ok(out) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("下载失败 (curl exit {}): {}", out.status, String::from_utf8_lossy(&out.stderr)),
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

#[tauri::command]
fn wiki_status() -> WindResult {
    run_wind(&["--json", "wiki", "status"])
}

#[tauri::command]
fn wiki_lint() -> WindResult {
    run_wind(&["--json", "wiki", "lint"])
}

#[tauri::command]
fn mkdir_dir(path: String) -> WindResult {
    run_wind(&["mkdir", &path])
}

#[tauri::command]
fn wft_open(file: String) -> WindResult {
    run_wind(&["wft", "file", &file])
}

#[tauri::command]
fn wiki_ingest(path: String) -> WindResult {
    run_wind(&["--json", "wiki", "ingest", &path])
}

#[tauri::command]
fn wiki_query(question: String) -> WindResult {
    run_wind(&["--json", "wiki", "query", &question])
}

#[tauri::command]
fn read_file(path: String) -> WindResult {
    let full_path = if std::path::Path::new(&path).is_absolute() {
        path
    } else {
        let workspace = wind::get_workspace_path();
        let ws = workspace.trim_end_matches('/');
        format!("{}/{}", ws, path)
    };
    run_wind(&["--json", "read", &full_path])
}

#[tauri::command]
fn get_wiki_dir() -> String {
    wind::get_wiki_dir()
}

#[tauri::command]
fn list_wiki() -> WindResult {
    run_wind(&["--json", "wiki", "status"])
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AiChatResult {
    pub ok: bool,
    pub response: String,
    pub commands_executed: Vec<String>,
    pub command_results: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

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

#[tauri::command]
async fn ai_chat(
    message: String,
    api_key: String,
    base_url: Option<String>,
    model: Option<String>,
) -> Result<AiChatResult, String> {
    let client = ChatClient::new(api_key, base_url.unwrap_or_default(), model);
    let workspace = wind::get_workspace_path();

    let system_msg = format!("{}\n\nCurrent workspace: {}", get_system_prompt(), workspace);

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

#[tauri::command]
fn get_api_config() -> serde_json::Value {
    serde_json::json!({
        "default_model": "MiniMax-M2.7-highspeed",
        "base_url": "https://df.dawnloadai.com:9888/v1"
    })
}

#[tauri::command]
fn winwork_save_state(relative_path: String, data: serde_json::Value) -> Result<(), String> {
    save_state(&relative_path, &data)
}

#[tauri::command]
fn winwork_load_state(relative_path: String) -> Result<serde_json::Value, String> {
    load_state(&relative_path)
}

#[tauri::command]
fn ensure_workspace_dir(name: String) -> Result<String, String> {
    state::ensure_workspace_dir(&name)
}

#[tauri::command]
fn list_workspaces() -> Result<Vec<String>, String> {
    state::list_workspaces()
}

#[tauri::command]
fn delete_workspace(name: String) -> Result<(), String> {
    state::delete_workspace(&name)
}

#[tauri::command]
fn get_winwork_root() -> String {
    state::winwork_root()
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
            get_winwork_version,
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
            winwork_save_state,
            winwork_load_state,
            ensure_workspace_dir,
            list_workspaces,
            delete_workspace,
            get_winwork_root,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}