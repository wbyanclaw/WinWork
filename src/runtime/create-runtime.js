// src/runtime/create-runtime.js
// Runtime adapter selection based on environment

import { createTauriAdapter } from './tauri-adapter.js';
import { createLocalDevAdapter } from './local-dev-adapter.js';

/**
 * Creates a runtime adapter based on environment.
 * @param {Object} options - Configuration options
 * @param {Object} options.tauri - Tauri bridge (window.__TAURI__) or null
 * @param {'auto'|'local'} options.mode - Runtime mode
 * @returns {Object} Runtime adapter with kind, getEnvironmentStatus, writeArtifact, ingestWiki, runTool
 */
export function createRuntime({ tauri = globalThis.__TAURI__, mode = 'auto' } = {}) {
  if (mode === 'local' || !tauri?.core?.invoke) {
    return createLocalDevAdapter();
  }
  return createTauriAdapter(tauri);
}