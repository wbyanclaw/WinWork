import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillPack } from '../../src/runtime/skill-packs/index.js';

test('report task resolves research_report pack', async () => {
  const pack = await resolveSkillPack('帮我写一份调研报告');
  assert.equal(pack.name, 'research_report');
  assert.equal(pack.artifact.required, true);
  assert.equal(pack.wiki.auto_ingest, true);
});

test('quick answer task returns quick_answer pack', async () => {
  const pack = await resolveSkillPack('什么是AI？');
  assert.equal(pack.name, 'quick_answer');
  assert.equal(pack.artifact.required, false);
});

test('未知任务返回 fallback', async () => {
  const pack = await resolveSkillPack('随便聊聊');
  assert.equal(pack.name, 'fallback');
});