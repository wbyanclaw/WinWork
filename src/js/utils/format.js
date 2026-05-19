// 格式化工具
const format = {
  // 格式化时间戳
  time(ts) {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
  },

  // 格式化文件大小
  fileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  },

  // 格式化命令结果显示
  commandResult(result) {
    if (result.ok) {
      return { success: true, message: result.stdout || '执行成功' };
    }
    return { success: false, message: result.stderr || result.stdout || '执行失败' };
  },

  // 高亮 JSON
  highlightJson(obj) {
    const s = JSON.stringify(obj, null, 2);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"([^"]+)":/g, '<span style="color:#1d4ed8">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span style="color:#059669">"$1"</span>')
      .replace(/: (true|false)/g, ': <span style="color:#d97706">$1</span>')
      .replace(/: (\d+)/g, ': <span style="color:#7c3aed">$1</span>');
  }
};