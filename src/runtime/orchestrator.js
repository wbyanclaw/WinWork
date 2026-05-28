// src/runtime/orchestrator.js
// Main product loop orchestrator - saves AI-generated artifacts to workspace

import { decideArtifactPlan } from './artifact-policy.js';

/**
 * Create an orchestrator that manages the artifact save flow.
 *
 * @param {Object} runtime - Runtime interface with tool execution methods
 * @param {Function} runtime.runTool - Execute wind-cli commands
 * @param {Function} runtime.writeArtifact - Persist content to workspace path
 * @param {Function} runtime.ingestWiki - Ingest file into wiki
 * @returns {Object} Orchestrator with execute method
 */
export function createOrchestrator(runtime) {
  return {
    /**
     * Execute task processing including artifact persistence.
     *
     * @param {Object} params - Execution parameters
     * @param {string} params.taskText - The original task text from user
     * @param {string} params.aiResponse - The AI-generated response content
     * @returns {Object} Execution result with response, artifact status, and trace
     */
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