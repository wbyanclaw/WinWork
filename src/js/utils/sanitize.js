// XSS 防护
const sanitize = {
  // HTML 转义
  html(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // 清理用户输入（允许基本格式）
  clean(str, maxLength = 10000) {
    if (!str) return '';
    let s = String(str);
    s = s.slice(0, maxLength);
    // 移除 script 标签
    s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // 移除事件处理器
    s = s.replace(/\bon\w+\s*=/gi, 'data-removed=');
    return s;
  },

  // 清理 AI 响应
  cleanAiResponse(text) {
    if (!text) return '';
    // 移除 <think> 标签
    let s = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\(<think>\)[\s\S]*?\)/gi, '')
      .replace(/<think>[\s\S]*$/gi, '')
      .replace(/<\/think>/gi, '');
    // 转义 HTML
    s = this.html(s.trim());
    // 保留换行
    s = s.replace(/\n/g, '<br>');
    return s;
  }
};

// 快捷函数
const escHtml = sanitize.html;