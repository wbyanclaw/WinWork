// 结果卡片组件
class ResultCard {
  static render(commands, extraInfo = {}) {
    const savedFiles = commands.filter(c => commandParser.extractWritePath(c.raw));
    const wikiIndexed = commands.filter(c => commandParser.isWikiIngest(c.raw));

    let notices = '';
    if (savedFiles.length > 0) {
      notices += `<div class="notice success">✅ 已保存到工作区: ${savedFiles.map(f => escHtml(f.path || f.args[0])).join(', ')}</div>`;
    }
    if (wikiIndexed.length > 0) {
      notices += `<div class="notice success">✅ 已索引到知识库</div>`;
    }

    let details = '';
    commands.forEach((cmd, i) => {
      const result = format.commandResult(cmd);
      details += `
        <div class="command-item ${result.success ? 'success' : 'error'}">
          <div class="command-header">
            <span class="command-icon">${result.success ? '✓' : '✗'}</span>
            <span class="command-name">$ wind ${escHtml(cmd.raw)}</span>
          </div>
          <div class="command-output">${escHtml(result.message)}</div>
        </div>
      `;
    });

    return `
      <div class="result-header">⚡ 执行结果</div>
      ${notices}
      <div class="command-list">${details}</div>
    `;
  }

  static renderError(message, retryFn) {
    return `
      <div class="result-header error">⚠️ 执行失败</div>
      <div class="error-message">${escHtml(message)}</div>
      ${retryFn ? `<button class="retry-btn" onclick="${retryFn}">重试</button>` : ''}
    `;
  }
}
