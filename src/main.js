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

console.log('[winwork] main.js loaded');