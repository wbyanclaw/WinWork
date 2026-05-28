// src/main.js
// Runtime initialization for winwork

// Import environment service for structured status handling
import { normalizeEnvironmentStatus, isEnvironmentReady } from './runtime/environment-service.js';

const { invoke } = window.__TAURI__.core;

// Application state
let appReady = false;

/**
 * Initialize the runtime environment.
 * Performs environment check and updates UI accordingly.
 */
async function initRuntime() {
  window._log && window._log('RUNTIME: initializing');

  let envStatus = null;

  try {
    // Get combined environment status using single backend call
    const raw = await invoke('get_environment_status');
    envStatus = normalizeEnvironmentStatus(raw);
    window._log && window._log('RUNTIME: env status received', JSON.stringify(envStatus));
  } catch(e) {
    window._log && window._log('RUNTIME: get_environment_status failed, using fallback', e);
    // Fallback handled in index.html checkAllEnv()
  }

  return envStatus;
}

/**
 * Check if the runtime is ready for full operation.
 * @returns {boolean} True if windcli is installed and ready
 */
function isReady() {
  return appReady;
}

export { initRuntime, normalizeEnvironmentStatus, isEnvironmentReady, isReady };