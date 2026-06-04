// src/runtime/tauri-adapter.js
// Thin adapter over window.__TAURI__.core.invoke

// v0.2.29 handler availability notes (see docs/superpowers/specs/...v0.2.29):
//   - A group (must-fix, backend exists): get_environment_status, write_workspace_artifact
//   - B group (degrade in v0.2.29, no backend): ingest_to_wiki, run_windcli
//   - C group (defer to v0.3.0): wiki_ingest / wiki_lint / wiki_query (call sites in index.html)

const V029_DEFER_V030_MSG = '该能力在 v0.2.29 未实现（v0.3.0 路线）';

/**
 * Creates a Tauri adapter wrapping window.__TAURI__.core.invoke
 * @param {Object} tauri - Tauri bridge
 * @returns {Object} Runtime adapter
 */
export function createTauriAdapter(tauri) {
  return {
    kind: 'tauri',
    async getEnvironmentStatus() {
      return await tauri.core.invoke('get_environment_status');
    },
    async writeArtifact({ path, content }) {
      // A group — registered in lib.rs (write_workspace_artifact).
      return await tauri.core.invoke('write_workspace_artifact', { relative_path: path, content });
    },
    async ingestWiki({ path }) {
      // B group — no backend in v0.2.29. Caller (orchestrator) treats
      // ok:false as "wiki not auto-ingested" and continues normally.
      console.warn('[tauri-adapter] ingestWiki: B-group handler not registered in v0.2.29; deferring wiki auto-ingest to v0.3.0');
      return { ok: false, stderr: V029_DEFER_V030_MSG };
    },
    async runTool(args) {
      // B group — no backend in v0.2.29. Most callers (orchestrator's
      // mkdir -p) tolerate a failure. Surface as ok:false so they can
      // decide whether to continue.
      console.warn('[tauri-adapter] runTool: B-group handler not registered in v0.2.29; tool call ignored, args=', args);
      return { ok: false, stderr: V029_DEFER_V030_MSG, args };
    }
  };
}