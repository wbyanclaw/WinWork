/**
 * Debug log module with stable buffer and auto-scroll behavior
 */

const MAX_LINES = 500;

const listeners = new Set();
const lines = [];

/**
 * Append a debug entry to the buffer and notify listeners
 * @param {string|Object} entry - Debug message or object
 */
export function appendDebug(entry) {
  const line = typeof entry === 'string' ? entry : JSON.stringify(entry);
  lines.push(line);
  if (lines.length >= MAX_LINES) {
    lines.shift();
  }
  for (const listener of listeners) {
    listener([...lines]);
  }
}

/**
 * Subscribe to debug log updates
 * @param {Function} listener - Callback receiving current lines array
 * @returns {Function} Unsubscribe function
 */
export function subscribeDebug(listener) {
  listeners.add(listener);
  // Send current lines on subscription
  listener([...lines]);
  return () => listeners.delete(listener);
}

/**
 * Get current debug log lines
 * @returns {string[]} Current lines
 */
export function getDebugLines() {
  return [...lines];
}

/**
 * Clear debug log
 */
export function clearDebug() {
  lines.length = 0;
}
