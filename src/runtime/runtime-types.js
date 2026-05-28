// src/runtime/runtime-types.js
// Structured environment status types for winwork

/**
 * @typedef {Object} WinworkVersion
 * @property {string} version - Current winwork version (e.g., '0.2.24')
 */

/**
 * @typedef {Object} WindcliStatus
 * @property {boolean} installed - Whether wind-cli is installed
 * @property {string|null} current - Current installed version (e.g., '0.3.0')
 * @property {string|null} latest - Latest available version (same as current if up-to-date)
 * @property {boolean} up_to_date - Whether current version is the latest
 * @property {string} path - Path to wind-cli binary
 * @property {string} display - Human-readable display string (e.g., 'wind-cli 0.3.0')
 */

/**
 * @typedef {Object} WikiStatus
 * @property {boolean} available - Whether wiki is available
 * @property {string|null} reason - Reason if not available
 */

/**
 * @typedef {Object} EnvironmentStatus
 * @property {WinworkVersion} winwork
 * @property {WindcliStatus} windcli
 * @property {WikiStatus} wiki
 */

/**
 * @typedef {Object} BackendPayload
 * @property {string} winworkVersion
 * @property {Object} windcli - { found: string, version: string, path: string }
 * @property {Object} wiki - { found: string, reason?: string }
 */

export const VERSION_STATES = {
  INSTALLED: 'installed',
  NOT_INSTALLED: 'not_installed',
  UNKNOWN: 'unknown'
};

export const UI_TEXT = {
  WINDCLI_NOT_INSTALLED: 'wind-cli 未安装',
  WINDCLI_INSTALLED: (version) => `wind-cli ${version}`,
  WIKI_AVAILABLE: '知识库可用',
  WIKI_NOT_AVAILABLE: (reason) => `知识库不可用: ${reason}`
};