# WinWork

企业协同 AI 助手 —— 通过深度融入工作流、共享上下文与组织知识库，让 AI 成为能与团队成员并行协作的"数字员工"。

v1.0 通过 wind-cli 管理本地工作区、llm-wiki 沉淀组织知识库，用户通过对话完成工作。

## Tech Stack

- **Runtime**: Tauri v2 (cross-platform, ~5MB)
- **Frontend**: Vanilla HTML/CSS/JS with Tailwind CSS + Lucide icons
- **Backend**: `wind-cli` CLI executed via Rust `std::process::Command`
- **AI**: Remote AI API (Claude/GPT-4o, user-configurable)

## Features

- Natural language conversation interface
- Unified file tree (workspace / wiki / SYSTEM.md)
- Simplified protocol trace in chat bubbles
- Collapsible detail panel (file info, full trace, provenance)
- wind-cli integration for secure workspace operations
- LLM Wiki knowledge base support

## UI Layout

```
┌──────────────┬──────────────────────┬──────────────┐
│ 文件树        │  对话                │ 详情（滑出） │
│ workspace/   │  简化链路            │ 文件信息     │
│ wiki/        │  工具卡片            │ 完整 trace   │
│ SYSTEM.md    │                     │ 溯源        │
└──────────────┴──────────────────────┴──────────────┘
```

## Mockup

Preview the current UI: [WinWork Mockup](docs/WinWork-mockup.html)

## Related

- [wind-cli](https://github.com/wbyanclaw/wind-cli)
- [LLM Wiki SDK](https://github.com/wbyanclaw/llm-wiki)
