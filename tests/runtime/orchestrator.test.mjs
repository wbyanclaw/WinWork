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