// 调试视图组件
class DebugView {
  constructor(container) {
    this.container = container;
    this.operations = [];
    this.currentTab = 'timeline';
  }

  render() {
    this.container.innerHTML = `
      <div class="debug-header">
        <button class="back-btn" onclick="app.closeDebug()">← 返回对话</button>
        <h2>调试视图</h2>
      </div>

      <div class="debug-tabs">
        <button class="tab ${this.currentTab === 'timeline' ? 'active' : ''}" onclick="debugView.switchTab('timeline')">
          操作步骤回放
        </button>
        <button class="tab ${this.currentTab === 'logs' ? 'active' : ''}" onclick="debugView.switchTab('logs')">
          实时日志
        </button>
        <button class="tab ${this.currentTab === 'env' ? 'active' : ''}" onclick="debugView.switchTab('env')">
          环境信息
        </button>
      </div>

      <div class="debug-content">
        <div id="debug-timeline" class="${this.currentTab === 'timeline' ? '' : 'hidden'}"></div>
        <div id="debug-logs" class="${this.currentTab === 'logs' ? '' : 'hidden'}"></div>
        <div id="debug-env" class="${this.currentTab === 'env' ? '' : 'hidden'}"></div>
      </div>
    `;

    this.renderTimeline();
    this.renderLogs();
    this.renderEnv();
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.debug-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.debug-tabs .tab:nth-child(${tab === 'timeline' ? 1 : tab === 'logs' ? 2 : 3})`).classList.add('active');
    document.getElementById('debug-timeline').classList.toggle('hidden', tab !== 'timeline');
    document.getElementById('debug-logs').classList.toggle('hidden', tab !== 'logs');
    document.getElementById('debug-env').classList.toggle('hidden', tab !== 'env');
  }

  renderTimeline() {
    const container = document.getElementById('debug-timeline');
    if (!container) return;

    if (this.operations.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无操作记录</div>';
      return;
    }

    container.innerHTML = this.operations.map((op, i) => `
      <div class="timeline-item">
        <div class="timeline-step">步骤 ${i + 1}</div>
        <div class="timeline-content">
          <div class="timeline-time">${format.time(op.timestamp)}</div>
          <div class="timeline-type">${escHtml(op.type)}</div>
          <div class="timeline-detail">${escHtml(op.detail)}</div>
        </div>
      </div>
    `).join('');
  }

  renderLogs() {
    const container = document.getElementById('debug-logs');
    if (!container) return;

    const logs = logger.getBuffer();
    container.innerHTML = `
      <div class="log-filters">
        <button onclick="logger.clear(); debugView.renderLogs();">清除</button>
      </div>
      <div class="log-entries">
        ${logs.map(log => `
          <div class="log-entry ${log.level}">
            <span class="log-time">${format.time(log.timestamp)}</span>
            <span class="log-level">[${log.level.toUpperCase()}]</span>
            <span class="log-source">[${log.source}]</span>
            <span class="log-message">${escHtml(log.message)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderEnv() {
    const container = document.getElementById('debug-env');
    if (!container) return;

    container.innerHTML = `
      <div class="env-info">
        <h3>环境信息</h3>
        <pre>${JSON.stringify({
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        }, null, 2)}</pre>
      </div>
    `;
  }

  addOperation(type, detail) {
    this.operations.push({
      timestamp: new Date().toISOString(),
      type,
      detail
    });
    if (this.currentTab === 'timeline') {
      this.renderTimeline();
    }
  }

  clear() {
    this.operations = [];
    this.renderTimeline();
  }
}
