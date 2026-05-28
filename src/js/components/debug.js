// Debug Component - 实用的调试视图
class DebugComponent {
  constructor() {
    this.currentTab = 'tools';
    this.view = null;
  }

  render() {
    this.view = document.getElementById('debug-view');
    this.view.classList.remove('hidden');
    this.view.style.display = 'flex';

    // Tab switching
    document.querySelectorAll('.debug-tabs .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === this.currentTab);
      tab.onclick = () => this.switchTab(tab.dataset.tab);
    });

    this.renderTab();
  }

  close() {
    if (this.view) {
      this.view.classList.add('hidden');
      this.view.style.display = '';
    }
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.debug-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== `tab-${tab}`);
    });
    this.renderTab();
  }

  renderTab() {
    switch (this.currentTab) {
      case 'tools':
        this.renderTools();
        break;
      case 'logs':
        this.renderLogs();
        break;
      case 'env':
        this.renderEnv();
        break;
    }
  }

  // 工具调用记录 - 最重要的调试信息
  renderTools() {
    const content = document.getElementById('tab-timeline');
    if (!content) return;

    const logs = logger.getBuffer().filter(e => e.level === 'tool' || e.level === 'api');
    if (logs.length === 0) {
      content.innerHTML = this.emptyState('暂无工具调用', 'AI 调用工具时会显示在这里');
      return;
    }

    content.innerHTML = logs.map(log => this.renderToolEntry(log)).join('');
    content.scrollTop = content.scrollHeight;
  }

  renderToolEntry(log) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const msg = typeof log.message === 'string' ? log.message : JSON.stringify(log.message, null, 2);

    return `<div class="debug-entry">
      <div class="debug-entry-header">
        <span class="debug-tag tool">${log.source.toUpperCase()}</span>
        <span class="debug-time">${time}</span>
      </div>
      <pre class="debug-entry-content">${this.escapeHtml(msg)}</pre>
    </div>`;
  }

  // 实时日志
  renderLogs() {
    const content = document.getElementById('tab-logs');
    if (!content) return;

    const logs = logger.getBuffer();
    if (logs.length === 0) {
      content.innerHTML = this.emptyState('暂无日志', '所有操作日志会显示在这里');
      return;
    }

    content.innerHTML = logs.map(log => this.renderLogEntry(log)).join('');
    content.scrollTop = content.scrollHeight;
  }

  renderLogEntry(log) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const colors = {
      info: '#3b82f6',
      user: '#8b5cf6',
      tool: '#f59e0b',
      api: '#10b981',
      error: '#ef4444',
      warn: '#f59e0b'
    };
    const color = colors[log.level] || '#64748b';
    const msg = typeof log.message === 'string' ? log.message : JSON.stringify(log.message);

    return `<div class="debug-log-entry" style="border-left: 3px solid ${color}">
      <span class="debug-tag" style="color:${color}">${log.level.toUpperCase()}</span>
      <span class="debug-source">${log.source}</span>
      <span class="debug-time">${time}</span>
      <div class="debug-log-msg">${this.escapeHtml(msg)}</div>
    </div>`;
  }

  // 环境信息 - 显示关键配置
  async renderEnv() {
    const content = document.getElementById('tab-env');
    if (!content) return;

    try {
      const wsPath = await invoke('get_workspace_path');
      const wikiPath = await invoke('get_wiki_path');
      const winworkVersion = await invoke('get_winwork_version');

      // 从 api 对象获取实际配置
      const apiKey = api.apiKey || localStorage.getItem('winwork_api_key');
      const apiBaseUrl = api.baseUrl || localStorage.getItem('winwork_api_base_url') || '默认';
      const apiModel = api.model || localStorage.getItem('winwork_api_model') || '未设置';

      const envData = {
        'WinWork 版本': winworkVersion,
        '工作区路径': wsPath,
        '知识库路径': wikiPath,
        'API Key': apiKey ? `已配置 (${apiKey.slice(0, 8)}...)` : '未配置',
        'API Model': apiModel,
        'API Base URL': apiBaseUrl
      };

      let html = '<div class="debug-env-section"><h4>配置文件</h4>';
      for (const [key, value] of Object.entries(envData)) {
        html += `<div class="debug-env-row">
          <span class="debug-env-key">${key}</span>
          <span class="debug-env-value">${this.escapeHtml(String(value))}</span>
        </div>`;
      }
      html += '</div>';

      // 版本信息
      html += '<div class="debug-env-section"><h4>版本信息</h4>';
      html += `<div class="debug-env-row">
        <span class="debug-env-key">wind-cli</span>
        <span class="debug-env-value" id="windcli-version-debug">检查中...</span>
      </div>`;
      html += '</div>';

      content.innerHTML = html;

      // 异步获取 wind-cli 版本
      this.checkWindCliVersion();

    } catch (e) {
      content.innerHTML = `<p style="color:#ef4444">加载环境信息失败: ${this.escapeHtml(e.message)}</p>`;
    }
  }

  async checkWindCliVersion() {
    try {
      const result = await invoke('run_command', { args: ['--version'] });
      if (result.ok) {
        const versionEl = document.getElementById('windcli-version-debug');
        if (versionEl) {
          versionEl.textContent = result.stdout.trim();
          versionEl.style.color = '#10b981';
        }
      }
    } catch (e) {
      const versionEl = document.getElementById('windcli-version-debug');
      if (versionEl) {
        versionEl.textContent = '未安装';
        versionEl.style.color = '#ef4444';
      }
    }
  }

  emptyState(title, desc) {
    return `<div class="debug-empty">
      <div class="debug-empty-icon">📋</div>
      <div class="debug-empty-title">${title}</div>
      <div class="debug-empty-desc">${desc}</div>
    </div>`;
  }

  clear() {
    logger.clear();
    this.renderTab();
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

const debugComponent = new DebugComponent();