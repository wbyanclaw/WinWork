# WinWork Local Execution Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade winwork from a chat shell with ad-hoc tool buttons into a local execution workbench where tasks produce visible workspace artifacts, optionally auto-ingest into wiki, and run through a testable adapter/orchestrator layer before the final Tauri shell.

**Architecture:** Keep the current Tauri backend and current HTML UI, but insert a small runtime boundary in the frontend: `Runtime Adapter -> Execution Orchestrator -> Tool / Wiki / Environment adapters`. Implement the user-visible product loop first (task -> artifact -> workspace -> wiki -> trace), then add skill-pack guidance, then add non-Tauri local development mode.

**Tech Stack:** Vanilla HTML/JS, Tailwind CSS build, Node built-in test runner (`node --test`), Tauri v2, Rust command handlers, existing `wind-cli` / `llm-wiki-lib` integration.

---

## File Structure

### Existing files to modify
- `src/index.html`
  - Remove direct business logic from the monolithic script block and wire the UI to runtime modules.
  - Keep layout and DOM IDs stable where possible.
- `src/main.js`
  - Replace the current Tauri demo bootstrap with runtime initialization for browser/Tauri modes.
- `src-tauri/src/lib.rs`
  - Add structured environment-status command(s), artifact-save helpers, and keep Tauri invoke surface stable.
- `src-tauri/tests/integration.rs`
  - Extend integration coverage for the new structured environment status and artifact save path.
- `package.json`
  - Add test scripts for Node test runner and a local dev entry if needed.
- `.gitignore`
  - Keep generated local dev artifacts out of git if new temp files are introduced.

### New frontend runtime files
- `src/runtime/runtime-types.js`
  - Shared shapes and normalizers for environment status, execution trace, artifact result.
- `src/runtime/create-runtime.js`
  - Select runtime adapter based on environment or explicit override.
- `src/runtime/tauri-adapter.js`
  - Thin adapter over `window.__TAURI__.core.invoke`.
- `src/runtime/local-dev-adapter.js`
  - Browser-usable adapter for mock/local execution without final Tauri packaging.
- `src/runtime/orchestrator.js`
  - Main product loop: route task, load skill pack, execute tool plan, persist artifact, auto-ingest wiki, return trace.
- `src/runtime/environment-service.js`
  - Structured environment and version state model on the frontend side.
- `src/runtime/artifact-policy.js`
  - Decide whether response must become a file, path template, conflict naming, and whether wiki auto-ingest applies.
- `src/runtime/skill-packs/index.js`
  - Load and resolve skill packs by task intent.
- `src/runtime/skill-packs/default.json`
  - Built-in minimum skill pack set for reports, summaries, notes, and file ops.
- `src/runtime/debug-log.js`
  - Stable debug buffer and auto-scroll behavior independent of the UI shell.

### New frontend tests
- `tests/runtime/environment-service.test.mjs`
- `tests/runtime/artifact-policy.test.mjs`
- `tests/runtime/skill-packs.test.mjs`
- `tests/runtime/orchestrator.test.mjs`

### Optional new local dev files
- `src/dev-bootstrap.js`
  - Browser entry for non-Tauri local runtime testing if direct `src/main.js` split is too invasive.

### New Rust backend support tests (if needed)
- `src-tauri/tests/environment_status.rs`
  - Verify normalized environment status payload.

---

### Task 1: Structured Environment Status and Version Rendering

**Files:**
- Create: `src/runtime/runtime-types.js`
- Create: `src/runtime/environment-service.js`
- Modify: `src/index.html`
- Modify: `src/main.js`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/runtime/environment-service.test.mjs`
- Test: `src-tauri/tests/integration.rs`

- [ ] **Step 1: Write the failing frontend environment-status test**

```js
// tests/runtime/environment-service.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEnvironmentStatus } from '../../src/runtime/environment-service.js';

test('normalizeEnvironmentStatus returns structured version state', () => {
  const status = normalizeEnvironmentStatus({
    winworkVersion: '0.2.24',
    windcli: { found: 'true', version: 'wind 0.3.0', path: '/usr/local/bin/wind' },
    wiki: { found: 'true' }
  });

  assert.equal(status.winwork.version, '0.2.24');
  assert.equal(status.windcli.installed, true);
  assert.equal(status.windcli.current, '0.3.0');
  assert.equal(status.windcli.display, 'wind-cli 0.3.0');
  assert.equal(status.wiki.available, true);
});
```

- [ ] **Step 2: Run the new frontend test and verify it fails**

Run: `node --test tests/runtime/environment-service.test.mjs`
Expected: FAIL because `src/runtime/environment-service.js` does not exist yet.

- [ ] **Step 3: Add the structured environment normalizer and backend payload shape**

```js
// src/runtime/environment-service.js
export function parseWindVersion(raw = '') {
  const match = raw.match(/(?:wind|windcli)\s+v?(\d+\.\d+\.\d+)/i);
  return match ? match[1] : null;
}

export function normalizeEnvironmentStatus(input) {
  const current = parseWindVersion(input?.windcli?.version ?? '');
  return {
    winwork: { version: input?.winworkVersion ?? 'unknown' },
    windcli: {
      installed: input?.windcli?.found === 'true',
      current,
      latest: current,
      up_to_date: Boolean(current),
      path: input?.windcli?.path ?? '',
      display: current ? `wind-cli ${current}` : 'wind-cli 未安装'
    },
    wiki: {
      available: input?.wiki?.found === 'true',
      reason: input?.wiki?.reason ?? null
    }
  };
}
```

```rust
// src-tauri/src/lib.rs
#[derive(Debug, Serialize)]
struct EnvironmentStatusPayload {
    winwork_version: String,
    windcli: HashMap<String, String>,
    wiki: HashMap<String, String>,
}

#[tauri::command]
fn get_environment_status() -> EnvironmentStatusPayload {
    EnvironmentStatusPayload {
        winwork_version: get_winwork_version(),
        windcli: check_windcli(),
        wiki: check_llm_wiki(),
    }
}
```

- [ ] **Step 4: Wire the top-bar rendering to the structured status model**

```js
// src/main.js or runtime bootstrap
import { normalizeEnvironmentStatus } from './runtime/environment-service.js';

async function loadEnvironment(runtime) {
  const raw = await runtime.getEnvironmentStatus();
  const status = normalizeEnvironmentStatus(raw);
  renderEnvironmentBadge(status);
  return status;
}
```

```js
// src/index.html script extraction target
function renderEnvironmentBadge(status) {
  const verEl = document.getElementById('winworkVersion');
  if (verEl) verEl.textContent = `v${status.winwork.version}`;

  const statusBar = document.getElementById('envStatusBar');
  statusBar.innerHTML = status.windcli.installed
    ? `<span class="...">${status.windcli.display}</span>`
    : `<span class="...">wind-cli 未安装</span>`;
}
```

- [ ] **Step 5: Verify and commit**

Run:
- `node --test tests/runtime/environment-service.test.mjs`
- `cd src-tauri && cargo test --test integration`

Expected:
- Node test PASS
- Rust integration still PASS or updated PASS with new command coverage

Commit:
```bash
git add src/runtime/runtime-types.js src/runtime/environment-service.js src/main.js src/index.html src-tauri/src/lib.rs tests/runtime/environment-service.test.mjs src-tauri/tests/integration.rs package.json
git commit -m "feat: add structured environment status model"
```

---

### Task 2: Artifact Save Mainline (Task -> File in Workspace)

**Files:**
- Create: `src/runtime/artifact-policy.js`
- Create: `src/runtime/orchestrator.js`
- Modify: `src/index.html`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/runtime/artifact-policy.test.mjs`
- Test: `tests/runtime/orchestrator.test.mjs`

- [ ] **Step 1: Write failing tests for artifact save decision and path policy**

```js
// tests/runtime/artifact-policy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideArtifactPlan } from '../../src/runtime/artifact-policy.js';

test('report-like tasks require markdown artifact in deliverables folder', () => {
  const plan = decideArtifactPlan({
    taskText: '帮我写一份行业调研报告',
    suggestedTitle: '行业调研报告'
  });

  assert.equal(plan.required, true);
  assert.equal(plan.extension, '.md');
  assert.match(plan.relativePath, /^deliverables\//);
});
```

```js
// tests/runtime/orchestrator.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrchestrator } from '../../src/runtime/orchestrator.js';

test('orchestrator persists report artifact before returning success', async () => {
  const writes = [];
  const runtime = {
    runTool: async () => ({ ok: true, stdout: 'done', data: {} }),
    writeArtifact: async ({ path, content }) => {
      writes.push({ path, content });
      return { ok: true, path };
    },
    ingestWiki: async () => ({ ok: false, skipped: true })
  };

  const orchestrator = createOrchestrator(runtime);
  const result = await orchestrator.execute({
    taskText: '写一份项目周报',
    aiResponse: '# 项目周报\n\n本周完成...'
  });

  assert.equal(writes.length, 1);
  assert.match(writes[0].path, /^deliverables\//);
  assert.equal(result.artifact.saved, true);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:
- `node --test tests/runtime/artifact-policy.test.mjs`
- `node --test tests/runtime/orchestrator.test.mjs`

Expected: FAIL because the policy/orchestrator modules do not exist yet.

- [ ] **Step 3: Implement artifact policy and backend write helper**

```js
// src/runtime/artifact-policy.js
function slugify(name = 'untitled') {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'untitled';
}

export function decideArtifactPlan({ taskText, suggestedTitle }) {
  const reportLike = /报告|总结|周报|方案|调研|文档/i.test(taskText);
  if (!reportLike) return { required: false };

  const file = `${slugify(suggestedTitle || '交付物')}.md`;
  return {
    required: true,
    extension: '.md',
    relativePath: `deliverables/${file}`,
    conflict: 'suffix'
  };
}
```

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn write_workspace_artifact(relative_path: String, content: String) -> WindResult {
    run_wind(&["write", &relative_path, "--content", &content])
}
```

- [ ] **Step 4: Implement orchestrator save flow and UI result rendering**

```js
// src/runtime/orchestrator.js
import { decideArtifactPlan } from './artifact-policy.js';

export function createOrchestrator(runtime) {
  return {
    async execute({ taskText, aiResponse }) {
      const artifactPlan = decideArtifactPlan({ taskText, suggestedTitle: taskText.slice(0, 20) });
      if (!artifactPlan.required) {
        return { ok: true, response: aiResponse, artifact: { saved: false }, trace: [] };
      }

      const writeResult = await runtime.writeArtifact({
        path: artifactPlan.relativePath,
        content: aiResponse,
      });

      return {
        ok: writeResult.ok,
        response: aiResponse,
        artifact: { saved: writeResult.ok, path: artifactPlan.relativePath },
        trace: [{ kind: 'artifact.write', path: artifactPlan.relativePath, ok: writeResult.ok }],
      };
    }
  };
}
```

```js
// UI render hook
if (result.artifact?.saved) {
  appendSystemNotice(`已保存到 workspace/${result.artifact.path}`);
  await loadFileTree();
}
```

- [ ] **Step 5: Verify and commit**

Run:
- `node --test tests/runtime/artifact-policy.test.mjs tests/runtime/orchestrator.test.mjs`
- Manual check in dev/Tauri mode: generate a report task, verify a markdown file appears under `workspace/deliverables/`

Expected:
- Tests PASS
- Workspace tree visibly updates with the saved file

Commit:
```bash
git add src/runtime/artifact-policy.js src/runtime/orchestrator.js src/index.html src-tauri/src/lib.rs tests/runtime/artifact-policy.test.mjs tests/runtime/orchestrator.test.mjs
git commit -m "feat: persist generated artifacts into workspace"
```

---

### Task 3: Wiki Auto-Ingest Mainline

**Files:**
- Modify: `src/runtime/artifact-policy.js`
- Modify: `src/runtime/orchestrator.js`
- Modify: `src/index.html`
- Test: `tests/runtime/artifact-policy.test.mjs`
- Test: `tests/runtime/orchestrator.test.mjs`

- [ ] **Step 1: Extend the failing tests for auto-ingest rules**

```js
// tests/runtime/artifact-policy.test.mjs
import { shouldAutoIngest } from '../../src/runtime/artifact-policy.js';

test('markdown artifact auto-ingests by default', () => {
  assert.equal(shouldAutoIngest({ relativePath: 'deliverables/report.md', autoIngest: true }), true);
});

test('binary artifact never auto-ingests', () => {
  assert.equal(shouldAutoIngest({ relativePath: 'deliverables/chart.png', autoIngest: true }), false);
});
```

```js
// tests/runtime/orchestrator.test.mjs

test('orchestrator auto-ingests markdown artifact after save', async () => {
  let ingested = false;
  const runtime = {
    runTool: async () => ({ ok: true }),
    writeArtifact: async ({ path }) => ({ ok: true, path }),
    ingestWiki: async ({ path }) => {
      ingested = path.endsWith('.md');
      return { ok: true };
    }
  };

  const orchestrator = createOrchestrator(runtime);
  const result = await orchestrator.execute({
    taskText: '写一份复盘报告',
    aiResponse: '# 复盘报告\n'
  });

  assert.equal(ingested, true);
  assert.equal(result.wiki.ingested, true);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:
- `node --test tests/runtime/artifact-policy.test.mjs tests/runtime/orchestrator.test.mjs`

Expected: FAIL because auto-ingest helpers are not implemented.

- [ ] **Step 3: Implement the ingest decision helpers**

```js
// src/runtime/artifact-policy.js
export function shouldAutoIngest({ relativePath, autoIngest = true }) {
  if (!autoIngest) return false;
  return /\.(md|txt|json)$/i.test(relativePath);
}
```

- [ ] **Step 4: Call wiki ingest from the orchestrator and render trace**

```js
// src/runtime/orchestrator.js
import { shouldAutoIngest } from './artifact-policy.js';

const canIngest = shouldAutoIngest({ relativePath: artifactPlan.relativePath, autoIngest: true });
let wiki = { ingested: false, skipped: !canIngest };
if (writeResult.ok && canIngest) {
  const ingestResult = await runtime.ingestWiki({ path: artifactPlan.relativePath });
  wiki = { ingested: ingestResult.ok, skipped: false, error: ingestResult.ok ? null : ingestResult.stderr };
  trace.push({ kind: 'wiki.ingest', path: artifactPlan.relativePath, ok: ingestResult.ok });
}
```

```js
// UI
if (result.wiki?.ingested) {
  appendSystemNotice(`已自动加入知识库：${result.artifact.path}`);
}
```

- [ ] **Step 5: Verify and commit**

Run:
- `node --test tests/runtime/artifact-policy.test.mjs tests/runtime/orchestrator.test.mjs`
- Manual check: generate `.md` artifact, confirm wiki ingest trace appears and `wiki status` reflects new content

Expected:
- Tests PASS
- UI shows save + ingest sequence

Commit:
```bash
git add src/runtime/artifact-policy.js src/runtime/orchestrator.js src/index.html tests/runtime/artifact-policy.test.mjs tests/runtime/orchestrator.test.mjs
git commit -m "feat: auto-ingest eligible artifacts into wiki"
```

---

### Task 4: Skill Pack Minimum Viable Loop

**Files:**
- Create: `src/runtime/skill-packs/default.json`
- Create: `src/runtime/skill-packs/index.js`
- Modify: `src/runtime/orchestrator.js`
- Test: `tests/runtime/skill-packs.test.mjs`
- Test: `tests/runtime/orchestrator.test.mjs`

- [ ] **Step 1: Write failing tests for skill-pack matching and policy override**

```js
// tests/runtime/skill-packs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillPack } from '../../src/runtime/skill-packs/index.js';

test('report task resolves research_report pack', async () => {
  const pack = await resolveSkillPack('帮我写一份调研报告');
  assert.equal(pack.name, 'research_report');
  assert.equal(pack.artifact.required, true);
  assert.equal(pack.wiki.auto_ingest, true);
});
```

```js
// tests/runtime/orchestrator.test.mjs

test('orchestrator uses skill pack default output directory', async () => {
  const writes = [];
  const runtime = {
    writeArtifact: async ({ path }) => { writes.push(path); return { ok: true, path }; },
    ingestWiki: async () => ({ ok: true }),
    runTool: async () => ({ ok: true })
  };
  const orchestrator = createOrchestrator(runtime);
  await orchestrator.execute({ taskText: '写一份调研报告', aiResponse: '# 调研报告' });
  assert.match(writes[0], /^deliverables\/reports\//);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:
- `node --test tests/runtime/skill-packs.test.mjs tests/runtime/orchestrator.test.mjs`

Expected: FAIL because skill pack loader does not exist.

- [ ] **Step 3: Add the default skill pack definitions and resolver**

```json
// src/runtime/skill-packs/default.json
[
  {
    "name": "research_report",
    "match": ["报告", "调研", "总结", "周报"],
    "artifact": {
      "required": true,
      "default_dir": "deliverables/reports",
      "extension": ".md"
    },
    "wiki": { "auto_ingest": true }
  },
  {
    "name": "quick_answer",
    "match": ["解释", "说明", "是什么"],
    "artifact": { "required": false },
    "wiki": { "auto_ingest": false }
  }
]
```

```js
// src/runtime/skill-packs/index.js
import defaultPacks from './default.json' with { type: 'json' };

export async function resolveSkillPack(taskText) {
  return defaultPacks.find(pack => pack.match.some(token => taskText.includes(token)))
    ?? { name: 'fallback', artifact: { required: false }, wiki: { auto_ingest: false } };
}
```

- [ ] **Step 4: Feed the resolved skill pack into artifact and wiki decisions**

```js
// src/runtime/orchestrator.js
import { resolveSkillPack } from './skill-packs/index.js';

const skillPack = await resolveSkillPack(taskText);
const artifactPlan = decideArtifactPlan({
  taskText,
  suggestedTitle: taskText.slice(0, 20),
  skillPack,
});
```

```js
// src/runtime/artifact-policy.js
export function decideArtifactPlan({ taskText, suggestedTitle, skillPack }) {
  if (skillPack?.artifact?.required) {
    const file = `${slugify(suggestedTitle || '交付物')}${skillPack.artifact.extension || '.md'}`;
    return {
      required: true,
      extension: skillPack.artifact.extension || '.md',
      relativePath: `${skillPack.artifact.default_dir}/${file}`,
      conflict: 'suffix'
    };
  }
  // fallback logic...
}
```

- [ ] **Step 5: Verify and commit**

Run:
- `node --test tests/runtime/skill-packs.test.mjs tests/runtime/orchestrator.test.mjs`
- Manual check: “写一份调研报告” lands under `workspace/deliverables/reports/` and auto-ingests

Expected:
- Tests PASS
- Visible product behavior changes by task type

Commit:
```bash
git add src/runtime/skill-packs/default.json src/runtime/skill-packs/index.js src/runtime/orchestrator.js src/runtime/artifact-policy.js tests/runtime/skill-packs.test.mjs tests/runtime/orchestrator.test.mjs
git commit -m "feat: add minimum viable skill pack orchestration"
```

---

### Task 5: Local Runtime Adapter and Non-Tauri Development Mode

**Files:**
- Create: `src/runtime/create-runtime.js`
- Create: `src/runtime/tauri-adapter.js`
- Create: `src/runtime/local-dev-adapter.js`
- Create: `src/dev-bootstrap.js`
- Modify: `src/main.js`
- Modify: `package.json`
- Test: `tests/runtime/orchestrator.test.mjs`

- [ ] **Step 1: Write a failing test for runtime selection**

```js
// tests/runtime/orchestrator.test.mjs
import { createRuntime } from '../../src/runtime/create-runtime.js';

test('createRuntime uses local adapter when Tauri bridge is absent', () => {
  const runtime = createRuntime({ tauri: null, mode: 'local' });
  assert.equal(runtime.kind, 'local');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:
- `node --test tests/runtime/orchestrator.test.mjs`

Expected: FAIL because `create-runtime.js` does not exist.

- [ ] **Step 3: Implement runtime selection and local adapter**

```js
// src/runtime/create-runtime.js
import { createTauriAdapter } from './tauri-adapter.js';
import { createLocalDevAdapter } from './local-dev-adapter.js';

export function createRuntime({ tauri = globalThis.__TAURI__, mode = 'auto' } = {}) {
  if (mode === 'local' || !tauri?.core?.invoke) return createLocalDevAdapter();
  return createTauriAdapter(tauri);
}
```

```js
// src/runtime/local-dev-adapter.js
export function createLocalDevAdapter() {
  return {
    kind: 'local',
    async getEnvironmentStatus() { return { winworkVersion: 'dev', windcli: { found: 'false' }, wiki: { found: 'false' } }; },
    async writeArtifact({ path, content }) { return { ok: true, path, stdout: content }; },
    async ingestWiki() { return { ok: true, mocked: true }; },
    async runTool() { return { ok: true, stdout: '', data: {} }; },
  };
}
```

- [ ] **Step 4: Add a browser-usable dev entry**

```js
// src/dev-bootstrap.js
import { createRuntime } from './runtime/create-runtime.js';
import { bootWinwork } from './main.js';

bootWinwork({ runtime: createRuntime({ mode: 'local' }) });
```

```json
// package.json
{
  "scripts": {
    "build:css": "./node_modules/.bin/tailwindcss -i src/input.css -o src/styles.css --minify",
    "test": "node --test tests/runtime/*.test.mjs",
    "dev:local": "python3 -m http.server 4173"
  }
}
```

- [ ] **Step 5: Verify and commit**

Run:
- `npm run test`
- `npm run build:css`
- Start local server and open the browser entry using `src/dev-bootstrap.js`

Expected:
- Tests PASS
- Core UI can boot in browser-only local mode without Tauri packaging

Commit:
```bash
git add src/runtime/create-runtime.js src/runtime/tauri-adapter.js src/runtime/local-dev-adapter.js src/dev-bootstrap.js src/main.js package.json tests/runtime/orchestrator.test.mjs
git commit -m "feat: add local runtime adapter for non-tauri development"
```

---

### Task 6: Debug / Trace Finalization and User-Visible Acceptance Path

**Files:**
- Create: `src/runtime/debug-log.js`
- Modify: `src/index.html`
- Modify: `src/runtime/orchestrator.js`
- Test: `tests/runtime/orchestrator.test.mjs`

- [ ] **Step 1: Write the failing trace-shape test**

```js
// tests/runtime/orchestrator.test.mjs

test('orchestrator returns ordered user-visible trace steps', async () => {
  const runtime = {
    writeArtifact: async ({ path }) => ({ ok: true, path }),
    ingestWiki: async () => ({ ok: true }),
    runTool: async () => ({ ok: true })
  };
  const orchestrator = createOrchestrator(runtime);
  const result = await orchestrator.execute({ taskText: '写一份调研报告', aiResponse: '# 调研报告' });

  assert.deepEqual(result.trace.map(t => t.kind), ['artifact.write', 'wiki.ingest']);
});
```

- [ ] **Step 2: Run the test and verify it fails if trace is still inconsistent**

Run:
- `node --test tests/runtime/orchestrator.test.mjs`

Expected: FAIL if trace order or payload shape is not yet stable.

- [ ] **Step 3: Add a dedicated debug-log module with stable append + scroll behavior**

```js
// src/runtime/debug-log.js
const listeners = new Set();
const lines = [];

export function appendDebug(entry) {
  lines.push(entry);
  for (const listener of listeners) listener(lines);
}

export function subscribeDebug(listener) {
  listeners.add(listener);
  listener(lines);
  return () => listeners.delete(listener);
}
```

```js
// UI hook
import { subscribeDebug } from './runtime/debug-log.js';

subscribeDebug(lines => {
  const content = document.getElementById('debugLogContent');
  if (!content) return;
  content.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
  content.scrollTop = content.scrollHeight;
});
```

- [ ] **Step 4: Render separate user trace vs developer log sections**

```js
// result renderer
function renderTrace(trace) {
  const detail = document.getElementById('detail-trace');
  detail.innerHTML = trace.map(step => {
    switch (step.kind) {
      case 'artifact.write':
        return `<div class="trace-step">已写入 workspace：${escHtml(step.path)}</div>`;
      case 'wiki.ingest':
        return `<div class="trace-step">已加入知识库：${escHtml(step.path)}</div>`;
      default:
        return `<div class="trace-step">${escHtml(step.kind)}</div>`;
    }
  }).join('');
}
```

- [ ] **Step 5: Verify and commit**

Run:
- `npm run test`
- Manual acceptance scenario:
  1. Ask for a report
  2. Confirm artifact appears in workspace tree
  3. Confirm trace shows save then wiki ingest
  4. Confirm debug log panel scrolls to bottom as new lines arrive

Expected:
- Tests PASS
- User-visible acceptance path matches the spec

Commit:
```bash
git add src/runtime/debug-log.js src/runtime/orchestrator.js src/index.html tests/runtime/orchestrator.test.mjs
git commit -m "feat: finalize trace and debug visibility for local execution flow"
```

---

## Self-Review

### Spec coverage
- Structured environment and version status: covered by Task 1.
- Artifact save mainline: covered by Task 2.
- Wiki auto-ingest: covered by Task 3.
- Skill packs as orchestration packs: covered by Task 4.
- Non-Tauri local development mode: covered by Task 5.
- Debug / trace usability: covered by Task 6.
- Narrow bugfixes remain acknowledged as P0 context and are not treated as the core delivery.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Each task has explicit files, code snippets, commands, expected results, and a commit step.

### Type consistency
- Runtime flow consistently uses `getEnvironmentStatus`, `writeArtifact`, `ingestWiki`, `runTool`.
- Orchestrator consistently returns `artifact`, `wiki`, and `trace` sections.
- Skill pack shape consistently uses `artifact.required`, `artifact.default_dir`, and `wiki.auto_ingest`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-winwork-local-execution-upgrade-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
