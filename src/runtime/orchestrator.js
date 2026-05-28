// src/runtime/orchestrator.js
// Main product loop orchestrator - saves AI-generated artifacts to workspace

import { decideArtifactPlan, shouldAutoIngest } from './artifact-policy.js';
import { resolveSkillPack } from './skill-packs/index.js';

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
      // Resolve skill pack before deciding artifact plan
      const skillPack = await resolveSkillPack(taskText);
      const artifactPlan = decideArtifactPlan({ taskText, suggestedTitle: taskText.slice(0, 20), skillPack });
      if (!artifactPlan.required) {
        return { ok: true, response: aiResponse, artifact: { saved: false }, trace: [] };
      }

      // Ensure the output directory exists before writing
      const outputDir = artifactPlan.relativePath.split('/').slice(0, -1).join('/');
      await runtime.runTool(`mkdir -p ${outputDir}`);

      const writeResult = await runtime.writeArtifact({
        path: artifactPlan.relativePath,
        content: aiResponse,
      });

      if (!writeResult.ok) {
        console.error(`[orchestrator] Failed to write artifact: ${artifactPlan.relativePath}`);
      }

      // After successful write, check if should auto-ingest
      const canIngest = shouldAutoIngest({
        relativePath: artifactPlan.relativePath,
        autoIngest: skillPack?.wiki?.auto_ingest ?? true
      });

      let wiki = { ingested: false, skipped: !canIngest };
      if (writeResult.ok && canIngest) {
        const ingestResult = await runtime.ingestWiki({ path: artifactPlan.relativePath });
        wiki = {
          ingested: ingestResult.ok,
          skipped: false,
          error: ingestResult.ok ? null : ingestResult.stderr
        };
      }

      const trace = [{ kind: 'artifact.write', path: artifactPlan.relativePath, ok: writeResult.ok }];
      if (wiki.ingested) {
        trace.push({ kind: 'wiki.ingest', path: artifactPlan.relativePath, ok: wiki.ingested });
      }

      return {
        ok: writeResult.ok,
        response: aiResponse,
        artifact: { saved: writeResult.ok, path: artifactPlan.relativePath },
        wiki,
        trace
      };
    }
  };
}