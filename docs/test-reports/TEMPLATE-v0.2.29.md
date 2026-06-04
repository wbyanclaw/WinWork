# v0.2.29 测试验收报告 TEMPLATE

日期：YYYY-MM-DD
版本：v0.2.29
报告人：@coder
对应规格：`docs/superpowers/specs/2026-06-04-winwork-v0.2.29-usable-release-design.md`
状态：Draft / In Review / Accepted

## 0. 报告使用说明

每行 v0.2.29 验收点都必须有：
- 用例 ID（`AC-xxx`，与规格章节对应）
- 工程侧验证（headless 截图 / sha256 / 自动化测试结果）
- 用户侧实机验证（Windows exe 跑过 @kevinywb 或人类）
- 结论（Pass / Fail / Partial + 备注）

**没有"用户侧实机"那一栏填值，不允许宣称"版本可用"。**（来源：主规格 4.4）

报告必须含的两类证据：
- 工程侧（reproducible，无人工）
- 用户侧（Windows 真机，不可省略）

## 1. 整体结论

| 项 | 结论 |
| --- | --- |
| 验收点总数 | N |
| Pass | N |
| Fail | N |
| Partial | N |
| 整体版本可用 | Yes / No |

**如果"整体版本可用 = No"，本版本不允许判 done。**（来源：主规格 8.0）

## 2. 验收点逐条

### 2.1 L0 验收点

#### AC-001 — 首屏 4 胶囊填实不卡占位（来自主规格 4.1 / 3.1 L0）
- **用例**：全新启动 + 标准 workspace
- **工程侧**：
  - 截图：`/tmp/winwork-screenshot/v0229/first-screen.png`
  - 截图 sha256（前 16 位）：`xxxxxxxxxxxxxxxx`
  - 4 胶囊填写结果：就绪 / 模型 / winwork ver / wind-cli ver
  - 等待时间（首屏 → 4 胶囊填实）：N 秒
- **用户侧**：
  - 测试人：@kevinywb
  - Windows 版本：
  - 复现命令：
  - 截图附件 ID：
  - 结论：Pass / Fail
- **结论**：

#### AC-002 — 切对话 / 切文件 / 切 tab 不抛前端异常
- **用例**：在 5 个不同对话 / 5 个不同文件 / 3 个 tab 之间切换
- **工程侧**：
  - DevTools console error 计数：N（应 = 0）
  - pageerror 事件计数：N（应 = 0）
  - 自动化测试：`npm run test` 输出（N pass / M fail）
- **用户侧**：
  - 测试人：@kevinywb
  - 操作路径：
  - 异常截图（如有）：
  - 结论：Pass / Fail
- **结论**：

#### AC-003 — v0.2.27 模板字面量 / 空元素引用 regression 不再现
- **用例**：`node --check` 所有 inline `<script>` 块 + 静态扫描
- **工程侧**：
  - `node --check` 输出：N errors
  - 静态扫描工具：grep `\`` 反斜杠反引号 + grep `getElementById` + null 守卫
  - 命中数：0
- **用户侧**：
  - 测试人：@kevinywb
  - 命令：触发 wiki / mkdir / wft / run_command
  - 异常：None
  - 结论：Pass / Fail
- **结论**：

### 2.2 L1 验收点

#### AC-101 — 首次启动可正确探测 wind-cli
- **用例**：
  - 路径 A：用户机器已有 windcli / wind（PATH 或 LOCALAPPDATA/winwork/wind-cli/）
  - 路径 B：用户机器没装 wind-cli
- **工程侧**：
  - 路径 A 截图：4 胶囊中 wind-cli 一栏显示 "wind-cli 0.3.0"
  - 路径 B 截图：installModal 弹出，按钮文案"⚡ 一键安装 wind-cli"
  - 后端日志：`get_environment_status` 返回值
- **用户侧**：
  - 测试人：@kevinywb
  - 路径 A 验证：
  - 路径 B 验证：
  - 结论：Pass / Fail
- **结论**：

#### AC-102 — 未安装时 install 入口可用，invoke 链路不断
- **用例**：在路径 B 状态下点"一键安装 wind-cli"按钮
- **工程侧**：
  - 静态扫描：前端所有 `invoke(...)` 字符串与后端 `generate_handler!` 列表做差集，结果必须为空集
  - diff 命令：`comm -23 <(grep -oE "invoke\\(['\"][^'\"]+" src/index.html | sort -u) <(grep -oE "^\\s+[a-z_]+," src-tauri/src/lib.rs | tr -d ' ,' | sort -u)`
  - 差集行数：0
  - 自动化脚本：`scripts/audit-invoke.sh` 输出
- **用户侧**：
  - 测试人：@kevinywb
  - 全新 Windows 机器（无 wind-cli）
  - 操作：装 release → 启动 → 点安装按钮
  - 期望：浏览器打开 wind-cli 下载页 / PowerShell 启动下载
  - 实际：
  - 结论：Pass / Fail
- **结论**：

#### AC-103 — 安装/检查/升级结果回 UI 是结构化状态
- **用例**：观察顶栏 4 胶囊的实时变化
- **工程侧**：
  - 截图序列：装前 / 装中 / 装后
  - 结构化字段：envState.windcli / windcliVersion / wiki / winworkVersion
  - 解析：用 `parseWindVersion()` 正则，不靠字符串猜测
- **用户侧**：
  - 测试人：@kevinywb
  - 观察路径：
  - 结论：Pass / Fail
- **结论**：

### 2.3 L2 验收点

#### AC-201 — 文件树稳定列出 workspace + wiki
- **用例**：加载标准 workspace（包含 SYSTEM.md / README.md / notes/ / deliverables/）
- **工程侧**：
  - 截图：左栏双 section 渲染
  - 截图 sha256：
  - SYSTEM.md 徽章位置正确性：第一项 + ⚙️ 图标 + 蓝色 SYSTEM 标签
  - workspace/ + wiki/ 双 section header 都存在
  - 文件排序：folder 在前，同类按名字升序
- **用户侧**：
  - 测试人：@kevinywb
  - 截图：
  - 结论：Pass / Fail
- **结论**：

#### AC-202 — 对话中可发起针对工作区的基本查询
- **用例**：在对话中输入"列出 workspace 下的所有 .md 文件"
- **工程侧**：
  - mock 模式下命令路由日志
  - 实际模式：wind-cli `ls` / `find` / `query` 命令
  - 结果回 UI：工具卡片 / 列表
- **用户侧**：
  - 测试人：@kevinywb
  - 自然语言输入：xxx
  - AI 响应 / 工具结果：
  - 结论：Pass / Fail
- **结论**：

#### AC-203 — `.md` 文件 markdown 预览，非纯文本
- **用例**：点击 SYSTEM.md（默认是 markdown）
- **工程侧**：
  - 截图：右侧详情"文件信息" tab
  - 渲染方式：`marked.parse(content)`，不是 `<pre>`
  - 视觉检查：标题 / 列表 / 代码块 / 强调 有样式
  - 控制台无 marked 报错
- **用户侧**：
  - 测试人：@kevinywb
  - 截图：
  - 结论：Pass / Fail
- **结论**：

#### AC-204 — 普通文本文件以可读文本显示
- **用例**：点击一个 .txt 或无后缀文件
- **工程侧**：
  - 截图：右侧"文件信息" tab 显示
  - 渲染：可读文本（等宽字体 + 保留空白），不是 hex dump
- **用户侧**：
  - 测试人：@kevinywb
  - 截图：
  - 结论：Pass / Fail
- **结论**：

#### AC-205 — 文件名 / 路径分段模糊匹配搜索
- **用例**：在左栏搜索框输入 "note"，期望 notes/ 2026-Q2.md 高亮
- **工程侧**：
  - mock 模式下输入 "note" → 结果数 + 高亮位置
  - 实际模式：后端搜索命令（如有）或前端纯 filter
  - 截图：搜索前 / 搜索后
- **用户侧**：
  - 测试人：@kevinywb
  - 搜索关键词：xxx
  - 期望结果：xxx
  - 实际结果：xxx
  - 结论：Pass / Fail
- **结论**：

#### AC-206 — 点击文件 → 打开详情 / 预览，trace 可见
- **用例**：在左栏点 SYSTEM.md → 右侧详情滑出
- **工程侧**：
  - 截图：详情面板"文件信息" tab 显示内容
  - "完整 trace" tab 显示：wind-cli 命令 + 参数 + 退出码 + 时长
  - "溯源" tab 显示：原始数据 + JSON
- **用户侧**：
  - 测试人：@kevinywb
  - 截图：
  - 结论：Pass / Fail
- **结论**：

### 2.4 工程交付材料

#### AC-301 — 开发规格书存在
- **工程侧**：
  - 路径：`docs/superpowers/specs/2026-06-04-winwork-v0.2.29-usable-release-design.md`
  - 状态：Formal（非 Draft）
- **结论**：

#### AC-302 — 本测试验收报告存在
- **工程侧**：
  - 路径：`docs/test-reports/v0.2.29-acceptance.md`（基于本 TEMPLATE 填充）
- **结论**：

## 3. 已知未覆盖（明确不承诺项）

按主规格 3.2，下列项目**不进入本版本验收**：
- 知识库完整闭环（wiki ingest / query / build / reindex）
- llm-wiki-lib 独立能力在 winwork 侧完整呈现
- "一键入库并可立即检索"完整工作流
- 跨组件知识库依赖协调完成

这些进入 v0.3.0（task #3）。

## 4. 风险与遗留

| 风险 | 等级 | 说明 | 缓解 |
| --- | --- | --- | --- |
| | | | |

## 5. 变更摘要（vs v0.2.28）

- 新增 invoke：
- 修复 bug：
- 改进 UI：
- 性能 / 体积：

## 6. 签字

- 工程侧：@coder + sha256
- 用户侧：@kevinywb / @yan + 日期
- 验收：@ruler + 日期
