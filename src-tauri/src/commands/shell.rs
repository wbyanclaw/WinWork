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
/// Handles 'ls' specially by prepending the workspace path.
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

    let first_arg = args[0].to_lowercase();
    if first_arg == "ls" {
        let workspace = crate::wind::get_workspace_path();
        let mut ls_args: Vec<&str> = vec!["--json", "ls", &workspace];
        for arg in args.iter().skip(1) {
            ls_args.push(arg);
        }
        eprintln!("[DIAGNOSTIC] run_command_impl: wind {}", ls_args.join(" "));
        let result = run_wind(&ls_args);
        return result.into();
    }

    let parts: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[DIAGNOSTIC] run_command_impl: wind {}", parts.join(" "));
    run_wind(&parts).into()
}