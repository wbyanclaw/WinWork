//! Bridge commands module for wind-cli execution.
//!
//! This module provides a structured way to organize Tauri commands
//! that interface with wind-cli functionality.

pub mod shell;
pub mod state;

// Re-export for use in lib.rs
pub use shell::run_command_impl;
pub use shell::run_command_with_stdin_impl;
pub use shell::CommandResult;
pub use state::{save_state_impl, load_state_impl};