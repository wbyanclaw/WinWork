//! Bridge commands module for wind-cli execution.
//!
//! This module provides a structured way to organize Tauri commands
//! that interface with wind-cli functionality.

pub mod shell;
pub mod file;
pub mod state;

pub use shell::run_command_impl;
pub use file::{save_file, read_file_impl, list_files_impl, select_folder_impl};
pub use state::{save_state_impl, load_state_impl};