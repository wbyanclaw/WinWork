// src/runtime/environment-service.js
// Environment status normalization for winwork

import { UI_TEXT } from './runtime-types.js';

/**
 * Parse version from raw wind-cli version string.
 * Handles formats like "wind 0.3.0", "wind-cli 0.3.0", "wind-cli version 0.3.0"
 * @param {string} raw - Raw version string from wind-cli --version
 * @returns {string|null} Parsed version (e.g., '0.3.0') or null if not found
 */
export function parseWindVersion(raw = '') {
  // Match patterns like "wind 0.3.0", "wind-cli 0.3.0", "wind-cli version 0.3.0"
  const match = raw.match(/(?:wind|windcli)\s+v?(\d+\.\d+\.\d+)/i);
  return match ? match[1] : null;
}

/**
 * Normalize backend payload to structured EnvironmentStatus.
 * This handles the transformation from raw Rust HashMap values to typed UI state.
 * @param {Object} input - Raw backend payload
 * @param {string} [input.winworkVersion] - Winwork version
 * @param {Object} [input.windcli] - { found: string, version: string, path: string }
 * @param {Object} [input.wiki] - { found: string, reason?: string }
 * @returns {Object} Structured environment status for UI rendering
 */
export function normalizeEnvironmentStatus(input) {
  const current = parseWindVersion(input?.windcli?.version ?? '');
  return {
    winwork: {
      version: input?.winworkVersion ?? 'unknown'
    },
    windcli: {
      installed: input?.windcli?.found === 'true',
      current,
      latest: current,
      up_to_date: Boolean(current),
      path: input?.windcli?.path ?? '',
      display: current ? `wind-cli ${current}` : UI_TEXT.WINDCLI_NOT_INSTALLED
    },
    wiki: {
      available: input?.wiki?.found === 'true',
      reason: input?.wiki?.reason ?? null
    }
  };
}

/**
 * Get human-readable version display for wind-cli.
 * @param {Object} status - windcli status object from normalizeEnvironmentStatus
 * @returns {string} Display text for UI
 */
export function getWindcliDisplay(status) {
  return status.display;
}

/**
 * Check if all components are ready for full functionality.
 * @param {Object} status - EnvironmentStatus from normalizeEnvironmentStatus
 * @returns {boolean} True if windcli is installed and ready
 */
export function isEnvironmentReady(status) {
  return status?.windcli?.installed === true;
}