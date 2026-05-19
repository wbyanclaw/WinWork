//! Shell commands bridge for wind-cli execution.

use crate::wind::{run_wind, WindResult};

/// Result structure for command execution.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CommandResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl From<WindResult> for CommandResult {
    fn from(result: WindResult) -> Self {
        CommandResult {
            ok: result.ok,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            data: result.data,
        }
    }
}

/// Run a wind-cli command with structured args.
/// wind-cli commands are designed to work relative to the workspace root,
/// so we don't need to prepend paths for most commands.
pub fn run_command_impl(args: Vec<String>) -> CommandResult {
    if args.is_empty() {
        return CommandResult {
            ok: false,
            stdout: String::new(),
            stderr: "No command provided".to_string(),
            exit_code: 1,
            data: None,
        };
    }

    let parts: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[DIAGNOSTIC] run_command_impl: wind {}", parts.join(" "));
    run_wind(&parts).into()
}

/// Run a wind-cli command with stdin input (for write commands).
pub fn run_command_with_stdin_impl(args: Vec<String>, stdin: String) -> CommandResult {
    if args.is_empty() {
        return CommandResult {
            ok: false,
            stdout: String::new(),
            stderr: "No command provided".to_string(),
            exit_code: 1,
            data: None,
        };
    }

    let parts: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    eprintln!("[DIAGNOSTIC] run_command_with_stdin: wind {} (stdin {} bytes)", parts.join(" "), stdin.len());

    // Use wind.rs's run_wind_with_input to handle stdin properly
    crate::wind::run_wind_with_input(&parts, &stdin).into()
}