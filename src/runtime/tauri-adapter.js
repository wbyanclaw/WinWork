// src/runtime/tauri-adapter.js
// Thin adapter over window.__TAURI__.core.invoke

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
      return await tauri.core.invoke('write_workspace_artifact', { relative_path: path, content });
    },
    async ingestWiki({ path }) {
      return await tauri.core.invoke('ingest_to_wiki', { relative_path: path });
    },
    async runTool(args) {
      return await tauri.core.invoke('run_windcli', args);
    }
  };
}