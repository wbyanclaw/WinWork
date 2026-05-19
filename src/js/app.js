// ── App Entry Point ────────────────────────────────────────
window.addEventListener('error', function (e) {
  window._log('JS ERROR:', e.message, '@', e.filename, 'line', e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
  window._log('UNHANDLED PROMISE REJECTION:', String(e.reason));
});

try { init(); } catch (e) { window._log('INIT: FATAL:', e.message, e.stack); }