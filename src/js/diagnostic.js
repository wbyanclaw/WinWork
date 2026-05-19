// ── Diagnostic Helpers ───────────────────────────────────────
async function doViewLogs() {
  const logs = window._logBuffer || [];
  let msg = '=== winwork 日志 ===\n';
  if (logs.length === 0) {
    msg += '(无日志)';
  } else {
    logs.forEach(l => {
      msg += `[${l.ts}] ${l.msg}\n`;
    });
  }
  appendMessage('agent', msg, document.getElementById('messages'));
}

async function doCheckWikiStatus() {
  const result = await invoke('wiki_status');
  let msg = '=== 知识库状态 ===\n';
  if (result.ok && result.data) {
    msg += `文件数: ${result.data.file_count || 0}\n`;
    msg += `路径: ${result.data.path || 'unknown'}`;
  } else {
    msg += '无法获取状态\n';
    msg += result.stderr || '';
  }
  appendMessage('agent', msg, document.getElementById('messages'));
}