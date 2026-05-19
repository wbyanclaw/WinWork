# winwork 交互重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 winwork 实现：Rust 仅做 bridge，前端完成全部业务逻辑，AI 自动保存交付物，界面清晰，调试友好

**Architecture:**
- Rust: 精简为纯 bridge，只执行 wind-cli 命令和基础文件操作
- 前端: HTML/JS 实现全部业务逻辑，模块化拆分
- 交互: ChatGPT 风格对话流 + 卡片展示结果 + 侧边栏导航

**Tech Stack:** Tauri 2, Vanilla JS, Tailwind CSS, wind-cli

---

## 文件结构变更

### 删除的前端文件
- `src/js/api.js` (LLM 调用移入 core/)
- `src/js/chat.js` (重构为 ui/chat.js)
- `src/js/display.js` (合并到 ui/cards.js)
- `src/js/detail.js` (合并到 ui/debug.js)
- `src/js/diagnostic.js` (合并到 ui/debug.js)
- `src/js/config.js` (合并到 core/storage.js)
- `src/js/install.js` (合并到 ui/sidebar.js)
- `src/js/window.js` (合并到 ui/sidebar.js)
- `src/js/upgrade.js` (合并到 core/api.js)
- `src/js/fileTree.js` (合并到 ui/sidebar.js)
- `src/js/state.js` (合并到 core/storage.js)
- `src/js/utils.js` (拆分到 utils/)

### 新增的前端文件
```
src/js/
├── core/
│   ├── api.js          # LLM API 调用 + system prompt
│   ├── command.js       # 命令解析与执行
│   └── storage.js       # 状态持久化
├── ui/
│   ├── sidebar.js       # 侧边栏组件
│   ├── chat.js          # 对话消息渲染
│   ├── cards.js         # 结果卡片组件
│   ├── status.js        # 状态指示器
│   └── debug.js         # 调试视图 + 日志
├── utils/
│   ├── log.js           # 日志系统
│   ├── format.js        # 格式化工具
│   └── sanitize.js      # XSS 防护
└── app.js               # 入口点
```

### 精简后的 Rust 文件
```
src-tauri/src/
├── lib.rs               # 注册 commands (精简)
├── commands/
│   ├── mod.rs
│   ├── shell.rs         # run_command
│   ├── file.rs          # 文件读写
│   └── state.rs         # 状态持久化
└── error.rs             # 统一错误类型
```

### 删除的 Rust 命令
- `ai_chat` - 移到前端
- `wiki_status`, `wiki_lint`, `wiki_ingest`, `wiki_query` - 移到前端
- `list_tools`, `get_version` - 简化
- `open_url` - 保留
- `trigger_install` - 简化
- `check_windcli`, `check_llm_wiki`, `check_upgrade`, `do_upgrade` - 合并为 `get_info`
- `init_demo_workspace`, `list_workspace`, `mkdir_dir`, `wft_open`, `add_wiki` - 简化
- `get_workspace_path`, `get_workspace_wiki_path`, `get_wiki_dir`, `list_wiki` - 保留
- `ensure_workspace_dir`, `list_workspaces`, `delete_workspace` - 保留
- `get_winwork_root`, `select_folder` - 保留

### 保留的 Rust 命令
| Command | 说明 |
|---------|------|
| `run_command` | 执行 wind-cli 命令 |
| `save_file` | 保存文件到工作区 |
| `read_file` | 读取文件 |
| `list_files` | 列出目录 |
| `get_info` | 获取环境信息 |
| `get_workspace_path` | 获取工作区路径 |
| `get_wiki_path` | 获取知识库路径 |
| `save_state` | 保存状态 |
| `load_state` | 加载状态 |
| `select_folder` | 选择文件夹 |

---

## Phase 1: Rust Bridge 精简

### Task 1: 创建 commands 目录结构

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/shell.rs`
- Create: `src-tauri/src/commands/file.rs`
- Create: `src-tauri/src/commands/state.rs`
- Create: `src-tauri/src/error.rs`

- [ ] **Step 1: 创建 commands/mod.rs**

```rust
pub mod shell;
pub mod file;
pub mod state;

pub use shell::run_command;
pub use file::{save_file, read_file, list_files, select_folder};
pub use state::{save_state, load_state, get_workspace_path, get_wiki_path};
```

- [ ] **Step 2: 创建 commands/shell.rs**

```rust
use crate::error::AppError;

#[derive(Debug, serde::Serialize)]
pub struct CommandResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[tauri::command]
pub fn run_command(args: Vec<String>) -> Result<CommandResult, AppError> {
    if args.is_empty() {
        return Err(AppError::InvalidInput("No command provided".into()));
    }
    // 执行 wind-cli 命令，逻辑从 lib.rs 移入
    let result = wind::run_wind(&args.iter().map(|s| s.as_str()).collect::<Vec<_>>());
    Ok(CommandResult {
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        data: result.data,
    })
}
```

- [ ] **Step 3: 创建 commands/file.rs**

```rust
#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), AppError> {
    // 写入文件到工作区
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, AppError> {
    // 读取文件
}

#[tauri::command]
pub fn list_files(path: Option<String>) -> Result<CommandResult, AppError> {
    // 列出目录
}

#[tauri::command]
pub async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    // 打开文件夹选择对话框
}
```

- [ ] **Step 4: 创建 commands/state.rs**

```rust
#[tauri::command]
pub fn save_state(key: String, data: serde_json::Value) -> Result<(), AppError> {
    // 保存状态
}

#[tauri::command]
pub fn load_state(key: String) -> Result<Option<serde_json::Value>, AppError> {
    // 加载状态
}

#[tauri::command]
pub fn get_workspace_path() -> String {
    // 获取工作区路径
}

#[tauri::command]
pub fn get_wiki_path() -> String {
    // 获取知识库路径
}
```

- [ ] **Step 5: 创建 error.rs**

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidInput(String),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Other(String),
}
```

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/commands/ src-tauri/src/error.rs
git commit -m "refactor: extract bridge commands to modules"
```

### Task 2: 精简 lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs` (精简为注册 bridge commands)
- Modify: `src-tauri/Cargo.toml` (添加 thiserror 依赖)

- [ ] **Step 1: 更新 Cargo.toml**

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
```

- [ ] **Step 2: 重写 lib.rs**

```rust
pub mod commands;
pub mod error;
pub mod wind;

use commands::{run_command, save_file, read_file, list_files, save_state, load_state, get_workspace_path, get_wiki_path};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_command,
            save_file,
            read_file,
            list_files,
            save_state,
            load_state,
            get_workspace_path,
            get_wiki_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: 提交**

```bash
git add src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "refactor: simplify lib.rs to pure bridge"
```

---

## Phase 2: 前端架构重构

### Task 3: 创建核心目录结构

**Files:**
- Create: `src/js/core/api.js`
- Create: `src/js/core/command.js`
- Create: `src/js/core/storage.js`
- Create: `src/js/utils/log.js`
- Create: `src/js/utils/format.js`
- Create: `src/js/utils/sanitize.js`

- [ ] **Step 1: 创建 core/storage.js**

```javascript
// 状态持久化
const storage = {
  async save(key, data) {
    return await invoke('save_state', { key, data: JSON.stringify(data) });
  },
  async load(key) {
    const data = await invoke('load_state', { key });
    return data ? JSON.parse(data) : null;
  }
};
```

- [ ] **Step 2: 创建 core/command.js**

```javascript
// 命令解析与执行
const commandParser = {
  parse(text) {
    const lines = text.split('\n');
    const commands = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[Executes:')) {
        const cmd = trimmed.replace(/^\[Executes:\s*|\]$/g, '').trim();
        commands.push(this.parseCommand(cmd));
      }
    }
    return commands;
  },
  parseCommand(cmd) {
    // 解析命令为 {name, args, flags}
  }
};

const commandExecutor = {
  async execute(cmd) {
    return await invoke('run_command', { args: [cmd] });
  }
};
```

- [ ] **Step 3: 创建 core/api.js**

```javascript
// LLM API 调用
const SYSTEM_PROMPT = `You are winwork, an AI assistant...

IMPORTANT:
1. When user asks to create code, documents, or any content that should be saved, ALWAYS use the write command
2. After writing, consider if wiki ingest is needed for documents/tutorials
3. Always wrap commands in [Executes: ...] format
4. Response in Chinese`;

const api = {
  async chat(message, apiKey, baseUrl, model) {
    // 调用 LLM API，返回响应
  }
};
```

- [ ] **Step 4: 创建 utils/log.js**

```javascript
// 日志系统
class Logger {
  constructor(maxSize = 500) {
    this.buffer = [];
    this.maxSize = maxSize;
  }
  log(level, source, message) {
    // 添加到 buffer
    // 持久化到文件
  }
}
```

- [ ] **Step 5: 提交**

```bash
git add src/js/core/ src/js/utils/
git commit -m "refactor: create frontend core modules"
```

### Task 4: 创建 UI 模块

**Files:**
- Create: `src/js/ui/sidebar.js`
- Create: `src/js/ui/chat.js`
- Create: `src/js/ui/cards.js`
- Create: `src/js/ui/status.js`
- Create: `src/js/ui/debug.js`

- [ ] **Step 1: 创建 ui/status.js**

```javascript
// 状态指示器
class StatusIndicator {
  constructor() {
    this.state = { windcli: 'loading', api: 'loading' };
  }
  update(type, status) {
    this.state[type] = status;
    this.render();
  }
  render() {
    // 渲染状态指示器 HTML
  }
}
```

- [ ] **Step 2: 创建 ui/sidebar.js**

```javascript
// 侧边栏组件
class Sidebar {
  constructor(container) {
    this.container = container;
    this.status = new StatusIndicator();
  }
  render() {
    this.container.innerHTML = `
      <div class="status-section">${this.status.render()}</div>
      <div class="actions-section">
        <button onclick="openFolder()">📂 打开文件夹</button>
        <button onclick="listFiles()">📋 列出文件</button>
        <button onclick="newFile()">📝 新建文件</button>
        <button onclick="openWiki()">📚 知识库</button>
      </div>
      <div class="tools-section">
        <button onclick="openSettings()">⚙️ 设置</button>
        <button onclick="openDebug()">🔧 诊断/日志</button>
      </div>
    `;
  }
}
```

- [ ] **Step 3: 创建 ui/chat.js**

```javascript
// 对话消息渲染
class ChatView {
  appendUserMessage(text) {
    // 渲染用户消息
  }
  appendAiMessage(text) {
    // 渲染 AI 消息
  }
  showThinking() {
    // 显示思考中
  }
  hideThinking() {
    // 隐藏思考中
  }
}
```

- [ ] **Step 4: 创建 ui/cards.js**

```javascript
// 结果卡片组件
class ResultCard {
  constructor(commands) {
    this.commands = commands;
  }
  render() {
    return `
      <div class="result-card">
        <div class="result-header">⚡ 执行结果</div>
        ${this.commands.map(cmd => `
          <div class="command-item">
            <div class="command-name">$ wind ${cmd.name}</div>
            <div class="command-result ${cmd.ok ? 'success' : 'error'}">
              ${cmd.ok ? '✅ ' + cmd.message : '❌ ' + cmd.error}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}
```

- [ ] **Step 5: 创建 ui/debug.js**

```javascript
// 调试视图 + 日志
class DebugView {
  render() {
    // 返回调试视图 HTML
  }
  renderTimeline(operations) {
    // 渲染操作步骤时间线
  }
  renderLiveLogs() {
    // 渲染实时日志
  }
}
```

- [ ] **Step 6: 提交**

```bash
git add src/js/ui/
git commit -m "refactor: create UI modules"
```

### Task 5: 重写 app.js 和 index.html

**Files:**
- Modify: `src/js/app.js` (重写为模块初始化)
- Modify: `src/index.html` (简化结构)
- Create: `src/styles.css` (合并样式)

- [ ] **Step 1: 重写 app.js**

```javascript
// 应用入口
import { Sidebar } from './ui/sidebar.js';
import { ChatView } from './ui/chat.js';
import { api } from './core/api.js';
import { Logger } from './utils/log.js';

class App {
  constructor() {
    this.logger = new Logger();
    this.chat = new ChatView();
    this.sidebar = new Sidebar(document.getElementById('sidebar'));
  }
  async init() {
    this.logger.info('app', 'Initializing...');
    this.sidebar.render();
    await this.checkEnv();
    this.logger.info('app', 'Ready');
  }
  async handleSend(message) {
    // 显示用户消息
    // 调用 AI
    // 解析命令
    // 执行并显示结果
  }
}
```

- [ ] **Step 2: 简化 index.html**

```html
<body>
  <div class="app-container">
    <aside id="sidebar" class="sidebar"></aside>
    <main class="main">
      <header class="header"></header>
      <div id="messages" class="messages"></div>
      <div id="debug-view" class="debug-view hidden"></div>
      <footer class="input-area">
        <textarea id="input" placeholder="描述你的需求..."></textarea>
        <button onclick="app.handleSend()">发送</button>
      </footer>
    </main>
  </div>
  <script type="module" src="js/app.js"></script>
</body>
```

- [ ] **Step 3: 提交**

```bash
git add src/js/app.js src/index.html
git commit -m "refactor: rewrite app entry point"
```

---

## Phase 3: AI 对话 + 交付物自动保存

### Task 6: 实现 AI 对话流

**Files:**
- Modify: `src/js/core/api.js`
- Modify: `src/js/core/command.js`
- Modify: `src/js/ui/chat.js`

- [ ] **Step 1: 实现 api.js 的 chat 方法**

```javascript
async chat(message, apiKey, baseUrl, model) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ],
      max_tokens: 4096
    })
  });
  const data = await response.json();
  return data.choices[0].message.content;
}
```

- [ ] **Step 2: 实现命令解析**

```javascript
parseCommands(text) {
  const regex = /\[Executes:\s*([^\]]+)\]/g;
  const commands = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cmdStr = match[1].trim();
    const parts = cmdStr.split(/\s+/);
    commands.push({
      raw: cmdStr,
      name: parts[0],
      args: parts.slice(1)
    });
  }
  return commands;
}
```

- [ ] **Step 3: 实现执行循环**

```javascript
async executeAndDisplay(text) {
  const commands = this.parseCommands(text);
  const results = [];
  for (const cmd of commands) {
    const result = await invoke('run_command', { args: [cmd.raw] });
    results.push({ ...cmd, ...result });
  }
  return results;
}
```

- [ ] **Step 4: 提交**

```bash
git commit -m "feat: implement AI chat flow with command execution"
```

### Task 7: 实现交付物自动保存

**Files:**
- Modify: `src/js/core/command.js`
- Modify: `src/js/ui/cards.js`

- [ ] **Step 1: 识别 write 命令并提取路径**

```javascript
// 识别 write 命令
extractWritePath(cmdStr) {
  if (!cmdStr.includes('write')) return null;
  const match = cmdStr.match(/write\s+(\S+)/);
  return match ? match[1] : null;
}

// 识别 wiki ingest 命令
isWikiIngest(cmdStr) {
  return cmdStr.includes('wiki') && cmdStr.includes('ingest');
}
```

- [ ] **Step 2: 修改卡片渲染，添加保存成功提示**

```javascript
renderResultCard(commands) {
  const savedFiles = commands.filter(c => this.extractWritePath(c.raw));
  const wikiIndexed = commands.filter(c => this.isWikiIngest(c.raw));

  return `
    <div class="result-card">
      ${savedFiles.length > 0 ? `
        <div class="save-notice">
          ✅ 已保存到工作区: ${savedFiles.map(f => f.path).join(', ')}
        </div>
      ` : ''}
      ${wikiIndexed.length > 0 ? `
        <div class="wiki-notice">
          ✅ 已索引到知识库
        </div>
      ` : ''}
      <!-- 命令详情 -->
    </div>
  `;
}
```

- [ ] **Step 3: 提交**

```bash
git commit -m "feat: auto-save deliverables to workspace and wiki"
```

---

## Phase 4: 调试/日志系统

### Task 8: 实现调试视图

**Files:**
- Modify: `src/js/ui/debug.js`
- Modify: `src/js/utils/log.js`

- [ ] **Step 1: 实现操作步骤时间线**

```javascript
renderTimeline(operations) {
  return `
    <div class="timeline">
      ${operations.map((op, i) => `
        <div class="timeline-item">
          <div class="timeline-step">步骤 ${i + 1}</div>
          <div class="timeline-content">
            <div class="timeline-time">${op.timestamp}</div>
            <div class="timeline-type">${op.type}</div>
            <div class="timeline-detail">${op.detail}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
```

- [ ] **Step 2: 实现实时日志面板**

```javascript
renderLiveLogs(logs) {
  return `
    <div class="log-panel">
      <div class="log-filters">
        <button onclick="filterLogs('all')">全部</button>
        <button onclick="filterLogs('error')">错误</button>
        <button onclick="filterLogs('warn')">警告</button>
      </div>
      <div class="log-entries">
        ${logs.map(log => `
          <div class="log-entry ${log.level}">
            <span class="log-time">${log.timestamp}</span>
            <span class="log-level">[${log.level}]</span>
            <span class="log-source">[${log.source}]</span>
            <span class="log-message">${log.message}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: 实现日志持久化**

```javascript
// 持久化到 ~/.winwork/logs/{date}.log
async persistLog(log) {
  const date = new Date().toISOString().split('T')[0];
  const key = `logs/${date}`;
  const logs = (await this.storage.load(key)) || [];
  logs.push(log);
  if (logs.length > 1000) logs.shift(); // 限制大小
  await this.storage.save(key, logs);
}
```

- [ ] **Step 4: 提交**

```bash
git commit -m "feat: add debug view and live logging"
```

---

## 验证清单

- [ ] Rust 编译通过
- [ ] 前端无语法错误
- [ ] AI 对话可正常调用
- [ ] wind-cli 命令可执行
- [ ] 交付物保存功能正常
- [ ] 调试视图可打开
- [ ] 日志可实时查看
- [ ] 状态持久化正常

---

## 执行选项

**1. Subagent-Driven (recommended)** - 每 Task 一个子 agent，任务间审查，快速迭代

**2. Inline Execution** - 在当前会话执行，定期审查
