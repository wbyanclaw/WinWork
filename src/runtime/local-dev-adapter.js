// src/runtime/local-dev-adapter.js
// Browser-usable adapter for mock/local execution

/**
 * Creates a local development adapter for browser-only testing
 * @returns {Object} Runtime adapter with mock implementations
 */
export function createLocalDevAdapter() {
  return {
    kind: 'local',
    async getEnvironmentStatus() {
      return {
        winworkVersion: 'dev',
        windcli: { found: 'false' },
        wiki: { found: 'false' }
      };
    },
    async writeArtifact({ path, content }) {
      console.log('[local-dev] writeArtifact:', path, content?.length, 'bytes');
      return { ok: true, path, stdout: content };
    },
    async ingestWiki({ path }) {
      console.log('[local-dev] ingestWiki:', path);
      return { ok: true, mocked: true };
    },
    async runTool(args) {
      console.log('[local-dev] runTool:', args);
      return { ok: true, stdout: 'mocked', data: {} };
    }
  };
}