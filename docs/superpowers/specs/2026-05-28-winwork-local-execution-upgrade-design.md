# WinWork 本地执行产品能力升级 Spec

日期：2026-05-28
状态：Draft for review
项目：winwork

## 1. 背景

winwork 当前已经具备基础的本地聊天界面、wind-cli 调用、wiki 按钮式操作、状态持久化与 Tauri 壳集成，但整体仍停留在“聊天壳 + 零散工具调用”的阶段。

本轮目标不是为了重构而重构，而是把产品能力往前推进一版，同时把实现组织整理到更合理、易测试、易维护的状态。

用户本轮明确提出的 4 个问题如下：

1. 新机器运行 winwork 时，顶部菜单栏 wind-cli 版本号缺失，点击后版本检查提示 `wind-cli unknown(最新)`，并出现空黑条。
2. winwork 没有充分使用 wind-cli 的能力，完成的交付物不会自动保存到 workspace，知识库也不会自动运转。
3. 要支持外置 skills 的能力，通过 skills 指引模型如何使用 wind-cli 或其他工具。
4. 调试窗口滚动失效；另外希望开发流程先把本地功能跑顺，再最后由 Tauri 壳承载，不要让 Tauri 打包成为本地产品迭代的前置阻塞。

## 2. 本轮产品定位

本轮 winwork 定位为：

- 一个以对话为入口的本地执行工作台；
- 但 workspace、wiki、skills、交付物回流必须是一等公民；
- 聊天不再只是“说完就结束”，而要驱动真实交付、保存、索引、再利用；
- 外置 skills 不是插件平台，而是“工具编排包”；
- 开发模式采用“双层解耦”：产品功能先稳定，Tauri 壳最后接入。

## 3. 本轮明确边界

### 3.1 要做的事

1. 修正环境与版本感知能力
2. 建立“任务执行 -> 交付物保存 -> wiki 自动回流”的主闭环
3. 引入外置 skills 作为模型工具编排层
4. 把本地开发模式与 Tauri 壳解耦
5. 让调试与执行链路可读、可滚动、可验证
6. 在不平台化的前提下，把代码组织整理到可测试、可维护的程度

### 3.2 这轮不做的事

1. 不做插件平台
2. 不支持 skills 自带任意脚本执行器
3. 不做多语言 runtime 插件系统
4. 不把 winwork 改造成通用 Agent IDE
5. 不把 wiki 改造成完全离线向量数据库产品
6. 不为了“结构完美”而先大规模重写 UI 或 Tauri 后端

## 4. 当前问题诊断

### 4.1 版本与环境检查问题

当前环境检查逻辑位于前端 `checkAllEnv()` 与 Tauri 后端 `check_windcli()`。

现状问题：
- 版本信息依赖 `wind --version` 的输出字符串，解析脆弱；
- “已是最新版本 / unknown(最新)” 类提示没有统一的数据模型；
- 弹窗展示逻辑与诊断信息混在一起，容易出现空白 UI 区域；
- 环境检查结果目前更像“字符串拼接”，不是结构化状态。

### 4.2 本地交付闭环断裂

当前 `ai_chat()` 模型只负责：
- 输出 `[Executes: ...]`
- 前端执行 `run_wind_command`
- 把执行结果显示在气泡里

但当前没有一条正式主链路去保证：
- 任务产物保存到 workspace；
- 保存后是否入 wiki；
- 哪些文件属于临时结果，哪些属于正式交付物；
- 交付物如何回到用户可见的 tree / detail / trace 中。

### 4.3 wiki 仍是按钮能力，不是自动能力

当前 wiki 主要通过：
- `wiki_ingest`
- `wiki_query`
- `wiki_lint`
- `wiki_status`

触发方式仍然是显式按钮或显式指令，不是“工作完成后自动回流”的一部分。

### 4.4 skills 缺位

当前系统 prompt 只是静态说明 `wind-cli` 命令能力，没有正式的外置编排层。问题包括：
- 不能按场景切换执行策略；
- 不能为不同任务类型声明不同工具组合；
- 不能规范输出物模板与回流规则；
- 不能把“怎么使用 wind-cli / wiki / 其他工具”的知识从主代码中抽离。

### 4.5 本地开发与 Tauri 壳过度耦合

当前前端通过 `window.__TAURI__.core.invoke` 直接调用 Tauri command。结果是：
- 本地前端调试必须依赖 Tauri 容器；
- 前端无法方便切 mock adapter / local adapter；
- 很多 UI 问题与 Tauri 生命周期、环境探测绑在一起；
- 不利于独立测试聊天、工具编排、trace 展示等本地产品能力。

## 5. 本轮目标能力

本轮完成后，winwork 应达到以下产品能力：

### 5.1 环境与版本感知可信

用户进入应用后，应能稳定看到：
- winwork 当前版本
- wind-cli 当前版本
- wind-cli 安装状态
- wind-cli 是否可升级
- wiki 能力是否可用

所有状态都应来自结构化数据，而不是前端字符串猜测。

### 5.2 交付物自动进入 workspace

当用户通过对话要求生成内容时：
- 模型不应只“回答结果”，而应优先形成交付物；
- 交付物必须写入 workspace 的明确路径；
- 写入后前端文件树可见；
- trace 中应明确显示“生成了什么、写到了哪里”。

### 5.3 wiki 自动回流

当交付物满足回流条件时：
- 系统自动判断是否应入 wiki；
- 对文本类成果自动触发 ingest；
- 将回流结果反馈到 UI；
- 用户无需手动再点一次“入库”。

### 5.4 外置 skills 成为工具编排层

skills 在本轮不是插件，而是：
- 一个外置配置/文档包；
- 声明在特定任务场景下应如何调用 wind-cli / wiki / 其他工具；
- 声明步骤模板、输出模板、保存策略、回流策略；
- 为模型提供稳定的执行指导。

### 5.5 本地功能面可独立开发与测试

前端不应必须运行在 Tauri 容器中才能测试核心功能。应支持：
- 浏览器本地模式；
- local runtime adapter；
- mock / real adapter 切换；
- 最终再由 Tauri 壳接入同一套能力接口。

## 6. 目标方案概览

本轮采取“产品功能升级 + 最小必要分层整理”的路径。

不是大规模重构，而是在现有前端和现有 Tauri command 之间，补一层最小必要的本地执行编排层，使产品主链路从“聊天 + 单次工具调用”升级为“任务执行工作台”。

目标结构如下：

```text
UI (chat / tree / detail / debug)
  -> Runtime Adapter
     -> Execution Orchestrator
        -> Tool Adapters (wind-cli / wiki / version / fs-state)
        -> Skill Pack Resolver
        -> Artifact Save Policy
        -> Wiki Auto-ingest Policy
  -> Tauri Shell Adapter (final packaging only)
```

## 7. 设计分段

### 7.1 UI 层职责

UI 继续承担：
- 对话输入
- 文件树展示
- trace / debug / detail 展示
- 环境状态提示
- workspace 切换

UI 不再直接承担：
- 业务执行编排
- 版本字符串解析
- 自动保存决策
- wiki 回流决策
- skills 解析

### 7.2 Runtime Adapter 层

新增统一接口层，前端只认识这个接口，而不是直接依赖 `window.__TAURI__.core.invoke`。

建议接口职责：
- `getEnvironmentStatus()`
- `executeTask(request)`
- `listWorkspace()`
- `readArtifact(path)`
- `getWikiStatus()`
- `getDebugStream()`

适配器实现分两类：

1. `TauriRuntimeAdapter`
   - 生产和桌面打包使用
   - 内部转发到 Tauri commands

2. `LocalDevAdapter`
   - 本地浏览器/开发模式使用
   - 可连接 mock 或本地服务
   - 不要求最终 Tauri 壳存在

### 7.3 Execution Orchestrator

这是本轮最关键的新增业务层。

职责：
- 接收用户任务请求
- 结合 skill pack 决定工具使用策略
- 调用 wind-cli / wiki / 其他工具
- 判断哪些结果属于交付物
- 把交付物保存到 workspace
- 按规则决定是否自动 ingest 到 wiki
- 生成结构化 trace 返回给 UI

这层是“产品继续往前”的核心，不是纯技术重构。

### 7.4 Tool Adapters

将现有零散能力收口为稳定接口。

最少包含：
- `WindCliAdapter`
- `WikiAdapter`
- `EnvironmentAdapter`
- `WorkspaceStateAdapter`

#### WindCliAdapter
职责：
- 统一 `ls/read/write/mkdir/rm/wft/...` 调用
- 统一命令参数与错误格式
- 提供结构化结果，不让 UI 自己猜 stdout/stderr

#### WikiAdapter
职责：
- 提供 `status/query/ingest/lint`
- 提供“可自动回流的文件类型规则”
- 返回结构化 ingest 结果

#### EnvironmentAdapter
职责：
- 统一 wind-cli 版本、安装状态、升级状态
- 不让前端直接依赖版本字符串解析细节

#### WorkspaceStateAdapter
职责：
- 统一 chat/tree/settings/global state 读写
- 补充交付物索引和最近产出记录

### 7.5 Artifact Save Policy

必须正式定义“交付物”的概念。

本轮规定：
- 任何面向用户交付的文本/文档型结果，默认优先保存为 workspace 文件；
- 纯解释性短回答可只显示在聊天中；
- 模型不能只说“我已经帮你写好了”，却不落文件。

保存策略至少包括：
- 默认保存目录
- 默认命名规则
- 扩展名推断规则
- 覆盖/重名冲突策略
- 是否需要用户确认

建议默认：
- 文本报告：`workspace/deliverables/`
- 临时草稿：`workspace/drafts/`
- 用户明确指定路径时，以用户路径为准

### 7.6 Wiki Auto-ingest Policy

自动回流不应覆盖所有文件，而要有明确规则。

本轮建议：
- 默认仅对文本类、文档类、结构化知识类产物自动入库；
- 二进制、临时中间文件不自动入库；
- 自动入库成功/失败要有 trace；
- 用户可关闭自动回流；
- skill pack 可以覆盖默认回流策略。

推荐默认自动 ingest 类型：
- `.md`
- `.txt`
- `.json`（仅文本结构结果）
- `.csv`（可选，后续视情况）

### 7.7 Skill Packs

本轮将 skills 定义为“工具编排包”，不是插件。

每个 skill pack 至少应能声明：
- 适用任务场景
- 推荐工具序列
- 输出物类型
- 默认保存路径模板
- 是否自动回流到 wiki
- 失败时的回退策略

示意结构：

```json
{
  "name": "research_report",
  "match": ["报告", "调研", "总结"],
  "tools": ["wind.write", "wiki.ingest"],
  "artifact": {
    "required": true,
    "default_dir": "deliverables/reports",
    "extension": ".md"
  },
  "wiki": {
    "auto_ingest": true
  }
}
```

本轮不做：
- 自定义可执行脚本
- 第三方插件 marketplace
- 热插拔代码执行

### 7.8 Debug / Trace 改造

调试窗口不能只是日志滚动容器，而应区分两种信息：

1. **用户可理解的执行链路**
   - 任务理解
   - skill 选择
   - 工具调用
   - 交付物保存
   - wiki 回流

2. **开发调试日志**
   - adapter 调用
   - invoke 参数
   - stdout/stderr
   - timeout / parse failure / fallback

要求：
- 滚动稳定可用
- 新日志自动滚到底
- 日志区域不遮挡主 UI
- 生产模式默认收起
- 可导出/复制关键 trace（后续可选）

### 7.9 版本与升级检查模型

本轮要求把版本/升级检查做成结构化状态：

```json
{
  "winwork": { "version": "0.2.24" },
  "windcli": {
    "installed": true,
    "current": "0.3.0",
    "latest": "0.3.0",
    "up_to_date": true,
    "path": "..."
  },
  "wiki": {
    "available": true,
    "reason": null
  }
}
```

UI 再根据这个状态渲染：
- 已安装/未安装
- 可升级/已最新
- 原因说明
- 不再由字符串拼接推断“unknown(最新)”之类状态

## 8. 用户流程

### 8.1 启动流程

1. 加载本地状态
2. 获取结构化环境状态
3. 初始化 workspace 入口
4. 加载 tree / 最近交付物 / wiki 状态
5. 如果 Tauri 不可用但 local adapter 可用，仍可进入本地功能模式

### 8.2 任务执行流程

1. 用户输入任务
2. orchestrator 判断是否命中 skill pack
3. 生成工具执行计划
4. 调用 wind-cli / wiki / 其他工具
5. 形成结构化结果
6. 若有交付物，保存到 workspace
7. 若满足规则，自动 ingest 到 wiki
8. 将结果、路径、回流状态、trace 回传 UI

### 8.3 知识回流流程

1. 交付物生成
2. 判断类型与 skill policy
3. 调用 wiki ingest
4. 更新 tree / wiki 状态
5. 在 trace 中显示入库结果

## 9. 代码组织目标

本轮不追求“工程重写”，只追求最小必要分层。

建议最少拆分：
- `runtime/adapter`
- `runtime/orchestrator`
- `runtime/skills`
- `runtime/tools`
- `state/`
- `ui/`

当前巨大 `src/index.html` 中的脚本逻辑，不应继续无限增长。
至少要把：
- env/version
- adapter access
- task execute
- artifact save / wiki policy
- debug rendering

从单文件脚本里拆出来。

## 10. 测试策略

### 10.1 必须可单测的部分

- version status parsing / normalization
- skill pack matching
- artifact save decision
- auto-ingest decision
- orchestrator task result shaping

### 10.2 必须可集测的部分

- runtime adapter -> wind-cli command path
- workspace file save -> tree visibility
- save -> wiki ingest chained flow
- no-Tauri local dev mode path

### 10.3 必须人工验收的部分

- 顶栏版本与升级状态展示
- 调试窗口滚动与可读性
- 交付物在 workspace 中真实可见
- wiki 自动回流体验
- skills 对任务执行路径的实际引导效果

## 11. 分阶段实施建议

### P0：窄 bugfix 收口

已知可接受的窄修复项：
- wind-cli 版本解析显示
- 升级提示空黑条
- debug log 滚动

这些可保留，但不视为完成本轮目标。

### P1：产品主链路补齐

- Runtime Adapter 抽象
- Environment status 结构化
- Execution Orchestrator
- Artifact Save Policy
- Wiki Auto-ingest Policy

### P2：Skills 接入

- skill pack 文件格式
- 任务匹配与工具编排
- 保存/回流策略绑定到 skills

### P3：本地开发模式脱壳

- LocalDevAdapter
- mock/real adapter 切换
- 前端本地可运行
- 最终 Tauri 壳只做接入

## 12. 验收标准

满足以下条件，才算本轮能力升级完成：

1. 新机器打开 winwork，顶栏能稳定显示正确的 winwork / wind-cli 版本与升级状态
2. 用户发起“生成文档/报告/总结”类任务时，交付物会自动写入 workspace，而不是只停留在聊天气泡
3. 符合规则的交付物会自动进入 wiki，且用户能看到回流结果
4. skills 能影响工具调用顺序、保存策略、回流策略，而不仅是静态 prompt 文本
5. 本地开发可在不依赖最终 Tauri 打包的情况下验证主要产品能力
6. 调试窗口滚动正常，链路信息对用户与开发都可读
7. 代码结构相比当前实现更容易做单测、集测和后续维护

## 13. 关键结论

本轮不是“重构项目”。

本轮是：
- 继续把 winwork 的产品能力往前推进；
- 把它从“聊天壳 + 零散工具按钮”升级为“本地执行工作台”；
- 同时只做最小必要的分层整理，让功能可测试、可维护、可持续迭代。
