import test from 'node:test';
import assert from 'node:assert/strict';
import { decideArtifactPlan, shouldAutoIngest } from '../../src/runtime/artifact-policy.js';

test('report-like tasks require markdown artifact in deliverables folder', () => {
  const plan = decideArtifactPlan({
    taskText: '帮我写一份行业调研报告',
    suggestedTitle: '行业调研报告'
  });

  assert.equal(plan.required, true);
  assert.equal(plan.extension, '.md');
  assert.match(plan.relativePath, /^deliverables\//);
});

test('markdown artifact auto-ingests by default', () => {
  assert.equal(shouldAutoIngest({ relativePath: 'deliverables/report.md', autoIngest: true }), true);
});

test('binary artifact never auto-ingests', () => {
  assert.equal(shouldAutoIngest({ relativePath: 'deliverables/chart.png', autoIngest: true }), false);
});