//! State persistence layer for winwork.

use std::path::PathBuf;

/// Resolve the winwork root directory: ~/.winwork/
pub fn winwork_root() -> Result<PathBuf, String> {
    directories::ProjectDirs::from("com", "winwork", "winwork")
        .map(|d| d.data_dir().to_path_buf())
        .ok_or_else(|| "Failed to resolve winwork data directory".to_string())
}

/// Resolve a path relative to the winwork root.
pub fn winwork_path(relative: &str) -> Result<PathBuf, String> {
    Ok(winwork_root()?.join(relative))
}

/// Write JSON data to a file in the winwork directory.
pub fn save_state(relative_path: &str, data: &serde_json::Value) -> Result<(), String> {
    let path = winwork_path(relative_path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;
    Ok(())
}

/// Read JSON data from a file in the winwork directory.
/// Returns null JSON value if the file does not exist.
pub fn load_state(relative_path: &str) -> Result<serde_json::Value, String> {
    let path = winwork_path(relative_path)?;
    let json_str = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(serde_json::Value::Null),
        Err(e) => return Err(format!("Failed to read {}: {}", path.display(), e)),
    };
    serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

/// Ensure a workspace directory exists and return its path.
pub fn ensure_workspace_dir(name: &str) -> Result<String, String> {
    let path = winwork_path("workspaces")?.join(name);
    std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create workspace '{}': {}", name, e))?;
    Ok(path.to_string_lossy().into_owned())
}

/// List all workspace names.
pub fn list_workspaces() -> Result<Vec<String>, String> {
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
pub fn delete_workspace(name: &str) -> Result<(), String> {
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
    if all.len() <= 1 && all.first() == Some(&name.to_string()) {
        return Err("Cannot delete the last workspace".to_string());
    }

    let workspace_path = winwork_path("workspaces")?.join(name);
    if !workspace_path.exists() {
        return Err(format!("Workspace '{}' does not exist", name));
    }

    std::fs::remove_dir_all(&workspace_path)
        .map_err(|e| format!("Failed to delete workspace '{}': {}", name, e))?;

    if name == active {
        let remaining = list_workspaces()?;
        if let Some(first) = remaining.first() {
            let new_state = serde_json::json!({ "activeWorkspace": first });
            let _ = std::fs::write(
                &state_path,
                serde_json::to_string_pretty(&new_state).unwrap_or_default(),
            );
        }
    }

    Ok(())
}
/// Get the configured workspace path
pub fn get_workspace_configured_path() -> Result<PathBuf, String> {
    let state_path = winwork_path("state.json")?;
    if !state_path.exists() {
        return winwork_root();
    }
    let json_str = std::fs::read_to_string(&state_path)
        .map_err(|e| format!("Failed to read state: {}", e))?;
    let state: serde_json::Value = serde_json::from_str(&json_str)
        .unwrap_or(serde_json::Value::Null);
    if let Some(path) = state.get("activeWorkspace").or(state.get("workspace")) {
        if let Some(p) = path.as_str() {
            return Ok(PathBuf::from(p));
        }
    }
    winwork_root()
}

/// Set workspace path
pub fn set_workspace_path(path: &str) -> Result<(), String> {
    let state_path = winwork_path("state.json")?;
    let state: serde_json::Value = if state_path.exists() {
        let s = std::fs::read_to_string(&state_path)
            .map_err(|e| format!("Failed to read state: {}", e))?;
        serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)
    } else {
        serde_json::Value::Null
    };
    let mut map = state.as_object().cloned().unwrap_or_default();
    map.insert("activeWorkspace".to_string(), serde_json::json!(path));
    save_state("state.json", &serde_json::to_value(map).unwrap())
}

/// Load config
pub fn load_config() -> serde_json::Map<String, serde_json::Value> {
    if let Ok(p) = winwork_path("config.json") {
        if let Ok(s) = std::fs::read_to_string(&p) {
            if let Ok(v) = serde_json::from_str(&s) {
                return v;
            }
        }
    }
    serde_json::Map::new()
}

/// Save config
pub fn save_config(config: &serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    save_state("config.json", &serde_json::to_value(config).unwrap())
}

/// Check if first run
pub fn is_first_run() -> bool {
    !winwork_path("config.json").map(|p| p.exists()).unwrap_or(false)
}

/// Create default readmes
pub fn create_default_readmes() -> Result<(), String> {
    let ws = get_workspace_configured_path()?;
    let readme = ws.join("README.md");
    if !readme.exists() {
        std::fs::write(&readme, "# Workspace\n\nWelcome to your winwork workspace.\n")
            .map_err(|e| format!("Failed to create README: {}", e))?;
    }
    let wiki = winwork_root()?.join("wiki");
    let wiki_readme = wiki.join("README.md");
    if !wiki_readme.exists() {
        std::fs::create_dir_all(&wiki)
            .map_err(|e| format!("Failed to create wiki dir: {}", e))?;
        std::fs::write(&wiki_readme, "# Wiki\n\nYour knowledge base.\n")
            .map_err(|e| format!("Failed to create wiki README: {}", e))?;
    }
    Ok(())
}

/// Ensure default config
pub fn ensure_default_config() -> Result<(), String> {
    if is_first_run() {
        let mut config = serde_json::Map::new();
        config.insert("theme".to_string(), serde_json::json!("dark"));
        config.insert("autoSave".to_string(), serde_json::json!(true));
        config.insert("wikiAutoIngest".to_string(), serde_json::json!(true));
        save_config(&config)?;
    }
    Ok(())
}

/// Default wiki path
pub fn default_wiki_path() -> PathBuf {
    winwork_root().map(|p| p.join("wiki")).unwrap_or_else(|_| PathBuf::from("~/.winwork/wiki"))
}
