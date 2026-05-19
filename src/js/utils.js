// ── Utils ────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
}

/// Strip AI model internal tokens (<think>...</think>,<think>, etc.)
function _sanitizeAiResponse(text) {
  let s = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\(<think>\)[\s\S]*?\)/gi, '')
    .replace(/<think>[\s\S]*?/gi, '')
    .replace(/<\/think>/gi, '');
  s = s.trim();
  return escHtml(s).replace(/\n/g, '<br>');
}

function highlightJSON(obj) {
  const s = JSON.stringify(obj, null, 2);
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#1d4ed8">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span style="color:#059669">"$1"</span>')
    .replace(/: (true|false)/g, ': <span style="color:#d97706">$1</span>')
    .replace(/: (\d+)/g, ': <span style="color:#7c3aed">$1</span>');
}