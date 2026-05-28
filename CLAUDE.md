# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Frontend CSS (Tailwind)
node node_modules/tailwindcss/lib/cli.js -i src/input.css -o src/styles.css --minify

# Tauri development (from src-tauri directory)
cargo build
cargo run

# Tauri release build
cargo build --release
```

## Architecture

**Tech Stack**: Tauri v2 + Vanilla HTML/CSS/JS + Tailwind CSS

### Frontend Structure (`src/`)
- `styles/` - CSS components (one file per component, e.g., `settings.css`, `chat.css`)
- `js/components/` - JS components with scoped functionality
- `js/core/` - Core modules (API, storage, command execution)
- `js/ui/` - UI-specific modules (chat, file-tree, sidebar)
- `js/utils/` - Utilities (logging, formatting, sanitization)

**Key Principle**: Each feature should be a self-contained component with its own JS and CSS files. Modifying one component should not affect others.

### Backend Structure (`src-tauri/src/`)
- `lib.rs` - Tauri command registration
- `state/` - State management module
  - `mod.rs` - Config loading/saving
  - `paths.rs` - Path resolution (workspace, wiki)
  - `init.rs` - First-run initialization
- `commands/` - Tauri command implementations
- `wind.rs` - wind-cli execution layer

## Default Paths
- Config: `%APPDATA%/com.winwork.winwork/`
- Workspace: `%USERPROFILE%/winwork/workspace/`
- Wiki: `%USERPROFILE%/winwork/wiki/`

## wind-cli Integration
The Rust backend executes `wind-cli` commands via `std::process::Command`. All business logic is in the frontend; Rust only bridges Tauri commands.
