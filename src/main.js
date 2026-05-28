// src/main.js
// Runtime initialization for winwork

// Import runtime adapter for environment and tool operations
import { createRuntime } from './runtime/create-runtime.js';
import { normalizeEnvironmentStatus, isEnvironmentReady } from './runtime/environment-service.js';

// Application state
let appReady = false;
let runtime = null;

/**
 * Boot winwork with the given runtime adapter.
 * @param {Object} options - Boot options
 * @param {Object} options.runtime - Runtime adapter to use (optional)
 */
function bootWinwork({ runtime: rt } = {}) {
  runtime = rt || createRuntime({ mode: 'auto' });
}

/**
 * Initialize the runtime environment.
 * Performs environment check and updates UI accordingly.
 */
async function initRuntime() {
  window._log && window._log('RUNTIME: initializing');

  if (!runtime) {
    runtime = createRuntime({ mode: 'auto' });
  }

  let envStatus = null;

  try {
    // Get combined environment status using runtime adapter
    const raw = await runtime.getEnvironmentStatus();
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

/**
 * Get the current runtime adapter.
 * @returns {Object} Runtime adapter
 */
function getRuntime() {
  return runtime;
}

export { bootWinwork, initRuntime, normalizeEnvironmentStatus, isEnvironmentReady, isReady, getRuntime };