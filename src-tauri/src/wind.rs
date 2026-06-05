//! wind-cli execution layer.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::process::{Command as StdCommand, Stdio};
use std::sync::{Arc, Mutex};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
fn add_no_window(cmd: &mut StdCommand) -> &mut StdCommand {
    cmd.creation_flags(0x08000000) // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn add_no_window(cmd: &mut StdCommand) -> &mut StdCommand {
    cmd
}

use which::which;
use tauri::AppHandle;

/// Shared upgrade progress state
static UPGRADE_PROGRESS: std::sync::LazyLock<Arc<Mutex<UpgradeProgress>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(UpgradeProgress::default())));

#[derive(Default)]
struct UpgradeProgress {
    stage: String,
    percent: u32,
    log: Vec<String>,
}

fn set_progress(stage: &str, percent: u32, log: Option<&str>) {
    let mut progress = UPGRADE_PROGRESS.lock().unwrap();
    progress.stage = stage.to_string();
    progress.percent = percent;
    if let Some(l) = log {
        progress.log.push(l.to_string());
        // Keep only last 20 log entries
        if progress.log.len() > 20 {
            progress.log.remove(0);
        }
    }
}

fn get_progress() -> (String, u32, Vec<String>) {
    let progress = UPGRADE_PROGRESS.lock().unwrap();
    (progress.stage.clone(), progress.percent, progress.log.clone())
}

/// Get current upgrade progress (for polling from frontend).
pub fn get_upgrade_progress() -> String {
    let (stage, percent, log) = get_progress();
    serde_json::json!({
        "stage": stage,
        "percent": percent,
        "log": log
    }).to_string()
}

/// Run upgrade with progress tracking and Tauri events.
pub fn do_upgrade_with_progress(_app: &AppHandle) -> WindResult {
    set_progress("准备中", 5, Some("开始检查 wind-cli 版本..."));

    let windcli = match crate::wind::find_windcli() {
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

    let version_before = crate::wind::get_windcli_version(&windcli);
    set_progress("检查版本", 10, Some(&format!("当前版本: {}", version_before)));

    // Check what install command is needed
    set_progress("获取更新信息", 20, Some("正在检查最新版本..."));
    let check_output = add_no_window(&mut StdCommand::new(&windcli))
        .args(["upgrade", "--check"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let check_output = match check_output {
        Ok(o) => o,
        Err(e) => {
            set_progress("错误", 100, Some(&format!("检查更新失败: {}", e)));
            return WindResult {
                ok: false,
                stdout: String::new(),
                stderr: format!("检查更新失败: {}", e),
                exit_code: -1,
                data: None,
            };
        }
    };

    let stdout = String::from_utf8_lossy(&check_output.stdout).to_string();

    // Parse JSON to get install command
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(_install_cmd) = json.get("install_command").and_then(|v| v.as_str()) {
            set_progress("下载中", 30, Some("正在下载最新版本..."));

            // Write install script to temp file to avoid command escaping issues
            let temp_dir = std::env::temp_dir();
            let script_path = temp_dir.join("windcli-upgrade.ps1");

            // Clean up any existing script
            let _ = fs::remove_file(&script_path);

            // Write the install script with UTF-8 BOM for PowerShell compatibility
            let bom: [u8; 3] = [0xEF, 0xBB, 0xBF];
            let script_content = format!(
                "# Wind-cli upgrade script\nirm https://github.com/wbyanclaw/wind-cli/releases/latest/download/install.ps1 -OutFile $env:TEMP\\windcli-install.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\\windcli-install.ps1 -NoPause\n",
            );
            let mut full_content = bom.to_vec();
            full_content.extend_from_slice(script_content.as_bytes());

            if let Err(e) = fs::write(&script_path, &full_content) {
                set_progress("错误", 100, Some(&format!("创建安装脚本失败: {}", e)));
                return WindResult {
                    ok: false,
                    stdout: String::new(),
                    stderr: format!("创建安装脚本失败: {}", e),
                    exit_code: -1,
                    data: None,
                };
            }

            set_progress("安装中", 50, Some("正在安装新版本..."));

            // Execute the script via PowerShell
            let ps_output = add_no_window(&mut StdCommand::new("powershell"))
                .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &script_path.to_string_lossy()])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output();

            // Clean up temp script
            let _ = fs::remove_file(&script_path);

            match ps_output {
                Ok(ps_out) => {
                    let ps_stdout = String::from_utf8_lossy(&ps_out.stdout).to_string();
                    let ps_stderr = String::from_utf8_lossy(&ps_out.stderr).to_string();
                    let ps_ok = ps_out.status.success();

                    set_progress(
                        "验证中",
                        80,
                        Some(if ps_ok { "安装完成，正在验证..." } else { "安装执行完成" }),
                    );

                    // Check new version
                    let new_version = crate::wind::find_windcli().and_then(|p| {
                        let v = crate::wind::get_windcli_version(&p);
                        if v != version_before {
                            Some((p, v))
                        } else {
                            None
                        }
                    });

                    set_progress("完成", 100, Some("验证完成"));

                    if let Some((path, version)) = new_version {
                        WindResult {
                            ok: true,
                            stdout: format!("升级成功! {} -> {}", version_before, version),
                            stderr: ps_stderr,
                            exit_code: 0,
                            data: Some(serde_json::json!({
                                "version": version,
                                "path": path
                            })),
                        }
                    } else {
                        WindResult {
                            ok: ps_ok,
                            stdout: format!("安装脚本执行{}", if ps_ok { "完成" } else { "失败" }),
                            stderr: format!("stdout: {}\nstderr: {}", ps_stdout, ps_stderr),
                            exit_code: ps_out.status.code().unwrap_or(-1),
                            data: None,
                        }
                    }
                }
                Err(e) => {
                    set_progress("错误", 100, Some(&format!("执行安装脚本失败: {}", e)));
                    WindResult {
                        ok: false,
                        stdout: stdout,
                        stderr: format!("执行安装脚本失败: {}", e),
                        exit_code: -1,
                        data: None,
                    }
                }
            }
        } else if json.get("upgrade_supported") == Some(&serde_json::Value::Bool(false)) {
            // Upgrade not supported
            let current = json.get("current_version").and_then(|v| v.as_str()).unwrap_or("unknown");
            let latest = json.get("latest_version").and_then(|v| v.as_str()).unwrap_or("unknown");
            set_progress("不支持", 100, Some("当前版本不支持自动升级"));
            WindResult {
                ok: true,
                stdout: format!("当前版本 {}，最新版本 {}。wind-cli {} 不支持自动升级，需手动下载安装", current, latest, current),
                stderr: String::new(),
                exit_code: 0,
                data: Some(serde_json::json!({
                    "current_version": current,
                    "latest_version": latest,
                    "manual_upgrade": true
                })),
            }
        } else {
            set_progress("完成", 100, Some("检查完成"));
            WindResult {
                ok: true,
                stdout: stdout,
                stderr: String::new(),
                exit_code: 0,
                data: None,
            }
        }
    } else {
        set_progress("完成", 100, Some("检查完成"));
        WindResult {
            ok: true,
            stdout: stdout,
            stderr: String::new(),
            exit_code: 0,
            data: None,
        }
    }
}

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

pub fn get_windcli_path() -> String {
    find_windcli().unwrap_or_else(|| "windcli".to_string())
}

/// Execute wind-cli with given arguments.
pub fn run_wind(args: &[&str]) -> WindResult {
    let wind_path = get_windcli_path();

    // Handle ls command specially - need to use --workspace param
    // --workspace is a GLOBAL option, must come BEFORE the command
    let is_ls_command = args.iter().any(|&a| a == "ls");
    let has_workspace = args.contains(&"--workspace");

    let processed_args: Vec<String> = if is_ls_command && !has_workspace {
        // Find ls position and any path after it
        let ls_pos = args.iter().position(|&a| a == "ls").unwrap_or(0);
        let path_after_ls = args.get(ls_pos + 1).and_then(|s| {
            if s.starts_with("--") { None } else { Some(*s) }
        });

        // Determine which path to use
        let target_path = if let Some(p) = path_after_ls {
            p.to_string()
        } else {
            get_workspace_path()
        };

        // Build: --workspace <path> ls .
        let mut result: Vec<String> = vec![
            "--workspace".to_string(),
            target_path,
            "ls".to_string(),
            ".".to_string()
        ];

        // Insert flags before --workspace (e.g., --json)
        for arg in args.iter().take(ls_pos) {
            result.insert(0, arg.to_string());
        }

        result
    } else if !has_workspace {
        // For other commands, add --workspace to ensure wind-cli uses WinWork's workspace
        let workspace = get_workspace_path();
        let mut result: Vec<String> = vec![];

        // Find position to insert --workspace (after --json if present, otherwise at beginning)
        let json_pos = args.iter().position(|&a| a == "--json");

        for (i, arg) in args.iter().enumerate() {
            result.push(arg.to_string());
            // Insert --workspace <path> after --json
            if let Some(pos) = json_pos {
                if i == pos {
                    result.push("--workspace".to_string());
                    result.push(workspace.clone());
                }
            }
        }

        // If no --json, prepend --workspace at position 1
        if json_pos.is_none() && !result.is_empty() {
            let first = result.remove(0);
            result.insert(0, "--workspace".to_string());
            result.insert(1, workspace);
            result.insert(2, first);
        }

        result
    } else {
        // Already has --workspace, pass through
        args.iter().map(|s| s.to_string()).collect()
    };

    eprintln!("[DIAGNOSTIC] run_wind: wind {}", processed_args.join(" "));

    // Convert Vec<String> to Vec<&str> for Command
    let arg_refs: Vec<&str> = processed_args.iter().map(|s| s.as_str()).collect();

    if which(&wind_path).is_err() {
        if which("windcli").is_ok() {
            let output = add_no_window(&mut StdCommand::new("windcli"))
                .args(&arg_refs)
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

    let output = add_no_window(&mut StdCommand::new(&wind_path))
        .args(&arg_refs)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    build_wind_result(output)
}

pub fn build_wind_result(output: Result<std::process::Output, std::io::Error>) -> WindResult {
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

/// Probe wind-cli version via a fallback chain.
/// v0.2.32 hotfix: 之前只跑 `wind --version`，如果 wind-cli 版本太老 / 不支持
/// 该 flag / 退出码非 0 就会卡在 "unknown"。现在按顺序试 --version / version / -V
/// / -v / help，任一成功即返回；同时把 raw stdout / stderr / exit_code /
/// 用了哪个 flag 一起存进 result，让前端 About modal 能展示原始输出。
///
/// Returns: (display_version, used_flag, raw_stdout, raw_stderr, exit_code)
fn probe_wind_version() -> (String, String, String, String, String) {
    let candidates: &[&[&str]] = &[
        &["--version"],
        &["version"],
        &["-V"],
        &["-v"],
        &["help"],
    ];
    for flag in candidates {
        let out = run_wind(flag);
        if out.ok {
            let stdout = out.stdout.trim().to_string();
            if !stdout.is_empty() {
                return (
                    stdout,
                    flag.join(" "),
                    out.stdout,
                    out.stderr,
                    out.exit_code.to_string(),
                );
            }
        } else {
            // 即便 exit_code 非 0，某些 wind-cli 会把版本号打到 stderr (e.g. clap default)
            let stderr = out.stderr.trim().to_string();
            if !stderr.is_empty() && looks_like_version_line(&stderr) {
                return (
                    stderr,
                    format!("{} (stderr)", flag.join(" ")),
                    out.stdout,
                    out.stderr,
                    out.exit_code.to_string(),
                );
            }
        }
    }
    (
        "unknown".to_string(),
        "none".to_string(),
        String::new(),
        String::new(),
        "-1".to_string(),
    )
}

fn looks_like_version_line(s: &str) -> bool {
    let first = s.lines().next().unwrap_or("");
    first.contains(|c: char| c.is_ascii_digit())
        && first.contains('.')
        && first.len() <= 128
}

/// Check if wind-cli is installed.
pub fn check_windcli() -> HashMap<String, String> {
    let mut result = HashMap::new();
    if let Some(path) = find_windcli() {
        result.insert("found".to_string(), "true".to_string());
        result.insert("path".to_string(), path.clone());
        result.insert("workspace_path".to_string(), get_workspace_path());

        // v0.2.32 hotfix: 探测链从单 --version 扩到多 fallback。
        let (display, used_flag, raw_stdout, raw_stderr, exit_code) = probe_wind_version();
        result.insert("version".to_string(), display);
        result.insert("version_flag".to_string(), used_flag);
        // raw_stdout/raw_stderr 截前 4KB，避免传输过大
        result.insert(
            "raw_stdout".to_string(),
            raw_stdout.chars().take(4096).collect::<String>(),
        );
        result.insert(
            "raw_stderr".to_string(),
            raw_stderr.chars().take(4096).collect::<String>(),
        );
        result.insert("exit_code".to_string(), exit_code);
    } else {
        result.insert("found".to_string(), "false".to_string());
        result.insert("version".to_string(), "未安装".to_string());
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

/// Get workspace path from winwork config (default: ~/Documents/WinWork/workspace/)
pub fn get_workspace_path() -> String {
    crate::state::get_workspace_configured_path()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "~/.winwork/workspace".to_string())
}

/// Get wiki path: <workspace>/wiki/
pub fn get_workspace_wiki_path() -> String {
    if let Ok(ws) = crate::state::get_workspace_configured_path() {
        return ws.join("wiki").to_string_lossy().into_owned();
    }
    get_wind_root().join("wiki").to_string_lossy().into_owned()
}

/// Get wiki directory path.
pub fn get_wiki_dir() -> String {
    get_workspace_wiki_path()
}

/// Get wiki path: use configured wiki path from winwork config, fallback to ~/winwork/wiki/
pub fn get_wiki_path() -> String {
    // First check if wiki path is configured in winwork state (wiki_path.json)
    if let Ok(state) = crate::state::load_state("wiki_path.json") {
        if let Some(path) = state.get("path").and_then(|v| v.as_str()) {
            if !path.is_empty() {
                return path.to_string();
            }
        }
    }
    // Also check config.json for wikiPath
    let config = crate::state::load_config();
    if let Some(path) = config.get("wikiPath").and_then(|v| v.as_str()) {
        if !path.is_empty() {
            return path.to_string();
        }
    }
    // Fallback to default wiki path: ~/winwork/wiki/
    crate::state::default_wiki_path().to_string_lossy().into_owned()
}

/// Read file content from the workspace.
pub fn read_file(path: &str) -> WindResult {
    // path is the relative file path like "README.md" or "subdir/file.md"
    // Use --workspace to specify the working directory
    let workspace = get_workspace_path();
    let ws = workspace.trim_end_matches('\\').trim_end_matches('/');
    run_wind(&["--json", "--workspace", ws, "read", path])
}

/// List files in a directory (or workspace root if no path provided).
pub fn list_files(path: Option<String>) -> WindResult {
    let target_path = path.unwrap_or_else(|| get_workspace_path());
    run_wind(&["--json", "ls", &target_path])
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

    let out = add_no_window(&mut StdCommand::new(&windcli))
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

    let output = add_no_window(&mut StdCommand::new(&windcli))
        .args(["upgrade", "--check"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();

            // Parse JSON response for structured data
            let mut current_version = String::new();
            let mut latest_version = String::new();
            let mut update_available = false;

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                if let Some(current) = json.get("current_version").and_then(|v| v.as_str()) {
                    current_version = current.to_string();
                }
                if let Some(latest) = json.get("latest_version").and_then(|v| v.as_str()) {
                    latest_version = latest.to_string();
                }
                if let Some(available) = json.get("update_available").and_then(|v| v.as_bool()) {
                    update_available = available;
                }
            }

            // Fallback: try to parse version numbers from text output
            if current_version.is_empty() || latest_version.is_empty() {
                for line in stdout.lines() {
                    let line_lower = line.to_lowercase();
                    if line_lower.contains("current") || line_lower.contains("your") {
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
            }

            // Fallback: text pattern check only if JSON parsing didn't confirm update status
            if !update_available && !current_version.is_empty() && !latest_version.is_empty() {
                update_available = current_version != latest_version;
            }

            // Only consider update available if versions are different
            let has_update = update_available && current_version != latest_version && !current_version.is_empty() && !latest_version.is_empty();

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

/// Trigger wind-cli self-upgrade via install script
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

    // Get version BEFORE upgrade
    let version_before = get_windcli_version(&windcli);

    // First check what install command is needed
    let check_output = add_no_window(&mut StdCommand::new(&windcli))
        .args(["upgrade", "--check"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match check_output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();

            // Parse JSON to get install command
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                if let Some(_install_cmd) = json.get("install_command").and_then(|v| v.as_str()) {
                    // Write install script to temp file to avoid command escaping issues
                    let temp_dir = std::env::temp_dir();
                    let script_path = temp_dir.join("windcli-upgrade.ps1");

                    // Clean up any existing script
                    let _ = fs::remove_file(&script_path);

                    // Write the install script with UTF-8 BOM for PowerShell compatibility
                    let bom: [u8; 3] = [0xEF, 0xBB, 0xBF];
                    let script_content = format!(
                        "# Wind-cli upgrade script\nirm https://github.com/wbyanclaw/wind-cli/releases/latest/download/install.ps1 -OutFile $env:TEMP\\windcli-install.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\\windcli-install.ps1 -NoPause\n",
                    );
                    let mut full_content = bom.to_vec();
                    full_content.extend_from_slice(script_content.as_bytes());

                    if let Err(e) = fs::write(&script_path, &full_content) {
                        set_progress("错误", 100, Some(&format!("创建安装脚本失败: {}", e)));
                        return WindResult {
                            ok: false,
                            stdout: String::new(),
                            stderr: format!("创建安装脚本失败: {}", e),
                            exit_code: -1,
                            data: None,
                        };
                    }

                    set_progress("下载中", 30, Some("正在下载最新版本..."));

                    // Execute the script via PowerShell
                    let ps_output = add_no_window(&mut StdCommand::new("powershell"))
                        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &script_path.to_string_lossy()])
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .output();

                    // Clean up temp script
                    let _ = fs::remove_file(&script_path);

                    match ps_output {
                        Ok(ps_out) => {
                            let ps_stdout = String::from_utf8_lossy(&ps_out.stdout).to_string();
                            let ps_stderr = String::from_utf8_lossy(&ps_out.stderr).to_string();
                            let ps_ok = ps_out.status.success();

                            // Check new version
                            let new_version = find_windcli()
                                .and_then(|p| {
                                    let v = get_windcli_version(&p);
                                    if v != version_before { Some((p, v)) } else { None }
                                });

                            if let Some((path, version)) = new_version {
                                WindResult {
                                    ok: true,
                                    stdout: format!("升级成功! {} -> {}", version_before, version),
                                    stderr: ps_stderr,
                                    exit_code: 0,
                                    data: Some(serde_json::json!({
                                        "version": version,
                                        "path": path
                                    })),
                                }
                            } else {
                                WindResult {
                                    ok: ps_ok,
                                    stdout: format!("安装脚本执行{}", if ps_ok { "完成" } else { "失败" }),
                                    stderr: format!("stdout: {}\nstderr: {}", ps_stdout, ps_stderr),
                                    exit_code: ps_out.status.code().unwrap_or(-1),
                                    data: None,
                                }
                            }
                        }
                        Err(e) => WindResult {
                            ok: false,
                            stdout: stdout,
                            stderr: format!("执行安装脚本失败: {}", e),
                            exit_code: -1,
                            data: None,
                        },
                    }
                } else if json.get("upgrade_supported") == Some(&serde_json::Value::Bool(false)) {
                    // Upgrade not supported, just check
                    let current = json.get("current_version").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let latest = json.get("latest_version").and_then(|v| v.as_str()).unwrap_or("unknown");
                    WindResult {
                        ok: true,
                        stdout: format!("当前版本 {}，最新版本 {}。wind-cli {} 不支持自动升级，需手动下载安装", current, latest, current),
                        stderr: String::new(),
                        exit_code: 0,
                        data: Some(serde_json::json!({
                            "current_version": current,
                            "latest_version": latest,
                            "manual_upgrade": true
                        })),
                    }
                } else {
                    WindResult {
                        ok: true,
                        stdout: stdout,
                        stderr: String::new(),
                        exit_code: 0,
                        data: None,
                    }
                }
            } else {
                WindResult {
                    ok: true,
                    stdout: stdout,
                    stderr: String::new(),
                    exit_code: 0,
                    data: None,
                }
            }
        }
        Err(e) => WindResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("检查更新失败: {}", e),
            exit_code: -1,
            data: None,
        },
    }
}

/// Get wind-cli version by running --version
fn get_windcli_version(path: &str) -> String {
    if let Ok(output) = add_no_window(&mut StdCommand::new(path))
        .args(["--version"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        "unknown".to_string()
    }
}

/// Execute wind-cli with stdin input (for write commands).
pub fn run_wind_with_input(args: &[&str], input: &str) -> WindResult {
    let wind_path = get_windcli_path();

    // Handle ls command specially - need to use --workspace param
    let is_ls_command = args.iter().any(|&a| a == "ls");
    let has_workspace = args.contains(&"--workspace");

    let processed_args: Vec<String> = if is_ls_command && !has_workspace {
        let ls_pos = args.iter().position(|&a| a == "ls").unwrap_or(0);
        let path_after_ls = args.get(ls_pos + 1).and_then(|s| {
            if s.starts_with("--") { None } else { Some(*s) }
        });

        let target_path = if let Some(p) = path_after_ls {
            p.to_string()
        } else {
            get_workspace_path()
        };

        let mut result: Vec<String> = vec![
            "--workspace".to_string(),
            target_path,
            "ls".to_string(),
            ".".to_string()
        ];

        for arg in args.iter().take(ls_pos) {
            result.insert(0, arg.to_string());
        }

        result
    } else if !has_workspace {
        // For other commands (like write), add --workspace to ensure wind-cli uses WinWork's workspace
        let workspace = get_workspace_path();
        let mut result: Vec<String> = vec![];

        // Find position to insert --workspace (after --json if present, otherwise at beginning)
        let json_pos = args.iter().position(|&a| a == "--json");

        for (i, arg) in args.iter().enumerate() {
            result.push(arg.to_string());
            // Insert --workspace <path> after --json
            if let Some(pos) = json_pos {
                if i == pos {
                    result.push("--workspace".to_string());
                    result.push(workspace.clone());
                }
            }
        }

        // If no --json, prepend --workspace at position 1
        if json_pos.is_none() && !result.is_empty() {
            let first = result.remove(0);
            result.insert(0, "--workspace".to_string());
            result.insert(1, workspace);
            result.insert(2, first);
        }

        result
    } else {
        args.iter().map(|s| s.to_string()).collect()
    };

    eprintln!("[DIAGNOSTIC] run_wind_with_input: wind {}", processed_args.join(" "));

    // Convert Vec<String> to Vec<&str> for Command
    let arg_refs: Vec<&str> = processed_args.iter().map(|s| s.as_str()).collect();

    let mut child = add_no_window(&mut StdCommand::new(&wind_path))
        .args(&arg_refs)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to spawn wind-cli");

    // Write stdin
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let _ = stdin.write_all(input.as_bytes());
    }

    let output = child.wait_with_output();

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