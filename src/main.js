// Tauri integration - exposes invoke globally
const { invoke } = window.__TAURI__.core;
window.invoke = invoke;

// Log unhandled errors
window.addEventListener('error', function (e) {
  console.error('JS ERROR:', e.message, '@', e.filename, 'line', e.lineno);
});

window.addEventListener('unhandledrejection', function (e) {
  console.error('UNHANDLED PROMISE REJECTION:', String(e.reason));
});

// Debug: Log when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('[DEBUG] DOMContentLoaded fired');
  console.log('[DEBUG] Body children:', document.body.children.length);
  console.log('[DEBUG] Messages element:', document.getElementById('messages'));
});

console.log('[winwork] main.js loaded');