# winwork 交互重构设计方案

**日期:** 2026-05-19
**目标:** 完善 winwork 的界面交互、AI交付物保存、调试体验、代码结构

---

## 一、架构原则

**核心原则:** HTML/JS 实现全部业务逻辑，Rust 仅做 bridge 通信。

```
┌──────────────────────────────────────┐
│         HTML/JS (业务逻辑)            │
│  - AI对话、LLM API调用                 │
│  - 命令解析、路由、执行                 │
│  - UI交互、状态管理                    │
│  - 知识库管理、文件操作                 │
└──────────────────┬───────────────────┘
                   │ Tauri invoke
┌──────────────────┴───────────────────┐
│         Rust (纯 bridge)               │
│  - run_wind_command(args) → wind-cli   │
│  - 文件读写、系统交互                   │
│  - 状态持久化                           │
│  - 窗口控制                             │
└──────────────────────────────────────┘
```

### Rust 精简后的 Command 列表

| Command | 参数 | 说明 |
|---------|------|------|
| `run_command` | `args: Vec<String>` | 执行 wind-cli 命令 |
| `get_workspace_path` | - | 获取工作区路径 |
| `get_wiki_path` | - | 获取知识库路径 |
| `save_file` | `path, content` | 保存文件到工作区 |
| `read_file` | `path` | 读取文件内容 |
| `list_files` | `path` | 列出目录 |
| `save_state` | `key, data` | 保存状态到本地 |
| `load_state` | `key` | 加载本地状态 |
| `get_env_info` | - | 获取环境信息 |

---

## 二、AI 对话 → 交付物自动保存

### 2.1 核心流程

```
用户输入 → LLM API → 解析响应
                      ↓
              检测 [Executes: wind ...]
                      ↓
              调用 Rust bridge 执行命令
                      ↓
              前端解析结果，卡片展示
                      ↓
              若为 write 成功 → 显示 "已保存到工作区"
              若同时有 ingest  → 显示 "已索引到知识库"
```

### 2.2 System Prompt (前端实现)

```javascript
const SYSTEM_PROMPT = `You are winwork, an AI assistant that helps users manage files.

Available operations:
- ls [path]: List directory contents
- read <file>: Read file content
- write <file> --stdin: Write file content (CRITICAL for saving deliverables)
- mkdir <path>: Create directory
- wiki ingest <path>: Index file to knowledge base

IMPORTANT:
1. When user asks to create code, documents, or any content that should be saved, ALWAYS use the write command
2. After writing, consider if wiki ingest is needed for documents/tutorials
3. Always wrap commands in [Executes: ...] format
4. Response in Chinese
`;
```

### 2.3 返回数据结构

```javascript
// LLM 返回格式
[Executes: wind write hello.go --stdin]
[Executes: wind wiki ingest hello.go]

// 前端解析后展示
✅ hello.go 已保存到工作区
✅ 已索引到知识库
```

### 2.4 卡片设计优化

```
┌────────────────────────────────────────┐
│ 🤖 AI 回复内容                          │
│                                        │
│ 代码块内容...                           │
├────────────────────────────────────────┤
│ ⚡ 执行结果                    [展开]   │
│ ├─ wind write hello.go                │
│ │  └─ ✅ 已保存到工作区                 │
│ └─ wind wiki ingest hello.go           │
│    └─ ✅ 已索引到知识库                 │
└────────────────────────────────────────┘
```

---

## 三、界面交互重构

### 3.1 整体布局

```
┌────────┬────────────────────────────────────────┐
│        │  [状态栏: wind-cli ✓  API ✓]           │
│  侧    ├────────────────────────────────────────┤
│  边    │                                        │
│  栏    │           对话区域                      │
│ 200px  │      (消息流 + 卡片)                   │
│        │                                        │
│        ├────────────────────────────────────────┤
│        │  [输入框: 描述需求...]        [发送]   │
└────────┴────────────────────────────────────────┘
```

### 3.2 左侧栏结构

```
┌──────────────────┐
│ ● wind-cli: 就绪  │  ← 状态指示器（可点击展开）
│ ● API: 已连接     │
├──────────────────┤
│ 📂 打开文件夹     │
│ 📋 列出文件       │
│ 📝 新建文件       │
│ 📚 知识库         │
├──────────────────┤
│ ⚙️ 设置          │
│ 🔧 诊断/日志      │
└──────────────────┘
```

### 3.3 状态指示器

- **绿色 + 文字** - 就绪/已连接
- **红色 + 文字** - 未安装/未配置（可点击触发安装/配置）
- **黄色 + 脉冲** - 加载中

点击展开详情：
```
┌─────────────────────┐
│ ● wind-cli          │
│   版本: 1.2.3       │
│   路径: C:\\...     │
├─────────────────────┤
│ ● API               │
│   模型: MiniMax-M2   │
│   状态: 已连接       │
│   [修改配置]         │
└─────────────────────┘
```

### 3.4 对话消息卡片

**用户消息：**
```
┌─────────────────────────────┐
│ 你好，帮我写一个Go程序   12:30│
└─────────────────────────────┘
```

**AI 消息：**
```
┌─────────────────────────────────────────┐
│ 🤖 好的，我来为你创建一个Go程序。          │
│                                         │
│ ```go                                  │
│ package main                           │
│ func main() {}                         │
│ ```                                    │
├─────────────────────────────────────────┤
│ ⚡ 执行结果                              │
│ ├─ wind write hello.go                  │
│ │  └─ ✅ 已保存                         │
│ └─ wind wiki ingest hello.go            │
│    └─ ✅ 已索引                         │
└─────────────────────────────────────────┘
```

**错误卡片：**
```
┌─────────────────────────────────────────┐
│ ⚠️ 执行失败                              │
│  wind: cannot create file                │
│  [查看详情] [重试]                       │
└─────────────────────────────────────────┘
```

---

## 四、调试/日志体验

### 4.1 调试视图

点击"诊断/日志"按钮，切换到调试页面：

```
┌──────────────────────────────────────────────────────────────┐
│  ← 返回对话                    调试视图                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [操作步骤回放]  [实时日志]  [环境信息]                       │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  12:30:15  用户输入                                          │
│  │  "帮我写一个Go程序"                                       │
│  │                                                          │
│  12:30:16  AI 解析                                           │
│  │  意图: 创建文件                                           │
│  │  计划: write → ingest                                     │
│  │                                                          │
│  12:30:16  wind write hello.go                               │
│  │  ├─ 命令: wind write hello.go --stdin                    │
│  │  ├─ 耗时: 120ms                                           │
│  │  ├─ 状态: ✅ 成功                                          │
│  │  └─ 输出: File written successfully                       │
│  │                                                          │
│  12:30:17  wind wiki ingest hello.go                         │
│  │  ├─ 命令: wind wiki ingest hello.go                       │
│  │  ├─ 耗时: 890ms                                           │
│  │  ├─ 状态: ✅ 成功                                          │
│  │  └─ 输出: Indexed 1 file                                   │
│  │                                                          │
│  12:30:18  完成                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 实时日志面板

```
┌─────────────────────────────────────────┐
│ 🔍 搜索...        [全部] [info] [warn] [error] │
├─────────────────────────────────────────┤
│ 12:30:15 INFO  [app] 初始化完成           │
│ 12:30:16 INFO  [api] 发送请求到 LLM       │
│ 12:30:16 INFO  [wind] wind write hello.go │
│ 12:30:16 INFO  [wind] 执行成功            │
│ 12:30:17 WARN  [wind] wiki ingest 耗时较长│
│ 12:30:17 INFO  [wind] 索引完成             │
└─────────────────────────────────────────┘
```

### 4.3 日志持久化

- 日志保存到 `~/.winwork/logs/`
- 按日期分文件：`2026-05-19.log`
- 最大保留 7 天

---

## 五、代码模块化重构

### 5.1 前端结构 (src/js/)

```
src/js/
├── core/                    # 核心逻辑
│   ├── api.js              # LLM API 调用
│   ├── command.js          # 命令解析与执行
│   └── storage.js          # 状态持久化
├── ui/                      # UI 组件
│   ├── sidebar.js          # 侧边栏
│   ├── chat.js             # 对话消息
│   ├── cards.js            # 结果卡片
│   └── status.js           # 状态指示器
├── utils/                   # 工具函数
│   ├── log.js              # 日志系统
│   ├── format.js           # 格式化工具
│   └── sanitize.js         # XSS 防护
└── app.js                   # 入口点
```

### 5.2 后端结构 (src-tauri/src/)

```
src-tauri/src/
├── lib.rs                   # Tauri 入口，注册 commands
├── commands/               # Bridge commands
│   ├── mod.rs
│   ├── shell.rs            # run_command
│   ├── file.rs             # 文件读写
│   └── state.rs            # 状态持久化
└── error.rs                # 统一错误类型
```

### 5.3 精简后的 Rust Command

```rust
// lib.rs
#[tauri::command]
fn run_command(args: Vec<String>) -> Result<CommandResult, String> {
    // 执行 wind-cli 命令，返回结构化结果
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    // 保存文件到工作区
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    // 读取文件
}

#[tauri::command]
fn get_info() -> AppInfo {
    // 返回环境信息
}
```

---

## 六、实现优先级

1. **Phase 1:** Rust bridge 精简 + 前端架构重构
2. **Phase 2:** AI 对话 + 交付物自动保存
3. **Phase 3:** 界面交互优化（侧边栏、状态指示器、卡片设计）
4. **Phase 4:** 调试/日志系统

---

## 七、验收标准

- [ ] 前端 JS 文件数量减少 50%
- [ ] AI 对话可自动保存交付物到工作区
- [ ] AI 对话可自动索引文档到知识库
- [ ] 界面清晰，一眼能看懂功能
- [ ] 问题出现时用户能快速定位原因
- [ ] 日志完整，可追溯每次操作
