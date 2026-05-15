# WinWork

AI Agent 智能文件管理演示平台 · Natural Language Interface

A client-facing demo application that demonstrates how AI Agents use wind-cli for secure file management through natural language interaction.

## Tech Stack

- **Runtime**: Tauri v2 (cross-platform, ~5MB)
- **Frontend**: Vanilla HTML/CSS/JS with Tailwind CSS + Lucide icons
- **AI Integration**: Remote AI API (Claude/GPT-4o, user-configurable)
- **File Operations**: `std::process::Command` (Rust side) executing `windcli` CLI

## Features

- Natural language conversation interface
- Unified file tree (workspace / wiki / SYSTEM.md)
- Simplified protocol trace in chat bubbles
- Collapsible detail panel with full trace and file info
- LLM Wiki knowledge base support
- wind-cli integration for secure file operations

## Mockup

Preview the current UI design:
- [WinWork Mockup](docs/WinWork-mockup.html)

## Architecture

```
Human (自然语言) ↔ AI Agent ↔ wind CLI
                              ↓
              工作区文件系统  或  windlocal:// → WFT 终端
```

## Links

- [wind-cli](https://github.com/wbyanclaw/wind-cli)
- [LLM Wiki SDK](https://github.com/wbyanclaw/llm-wiki)
