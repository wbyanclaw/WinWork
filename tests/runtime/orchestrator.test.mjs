import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrchestrator } from '../../src/runtime/orchestrator.js';
import { createRuntime } from '../../src/runtime/create-runtime.js';

test('createRuntime uses local adapter when Tauri bridge is absent', () => {
  const runtime = createRuntime({ tauri: null, mode: 'local' });
  assert.equal(runtime.kind, 'local');
});

test('createRuntime uses tauri adapter when Tauri bridge is present', () => {
  const mockTauri = {
    core: {
      invoke: async () => ({})
    }
  };
  const runtime = createRuntime({ tauri: mockTauri, mode: 'auto' });
  assert.equal(runtime.kind, 'tauri');
});

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

test('orchestrator uses skill pack default output directory', async () => {
  const writes = [];
  const runtime = {
    runTool: async () => ({ ok: true }),
    writeArtifact: async ({ path }) => { writes.push(path); return { ok: true, path }; },
    ingestWiki: async () => ({ ok: true })
  };
  const orchestrator = createOrchestrator(runtime);
  await orchestrator.execute({ taskText: '写一份调研报告', aiResponse: '# 调研报告' });
  assert.match(writes[0], /^deliverables\/reports\//);
});