//! State management bridge for wind-cli.

use crate::state::{load_state as state_load, save_state as state_save};

/// Save state data with a given key.
pub fn save_state_impl(key: String, data: serde_json::Value) -> Result<(), String> {
    state_save(&key, &data)
}

/// Load state data by key.
pub fn load_state_impl(key: String) -> Result<serde_json::Value, String> {
    state_load(&key)
}
