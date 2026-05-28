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