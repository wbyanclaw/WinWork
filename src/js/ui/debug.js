// 调试视图组件
class DebugView {
  constructor(container) {
    this.container = container;
    this.currentTab = 'timeline';
  }

  render() {
    this.container.innerHTML = `
      <div class="debug-header">
        <button class="back-btn" onclick="app.closeDebug()">← 返回对话</button>
        <h2>调试视图</h2>
        <button class="clear-btn" onclick="app.clearLogs()">清除日志</button>
      </div>

      <div class="debug-tabs">
        <button class="tab active" data-tab="timeline" onclick="window.debugView?.switchTab('timeline')">操作步骤</button>
        <button class="tab" data-tab="logs" onclick="window.debugView?.switchTab('logs')">实时日志</button>
        <button class="tab" data-tab="env" onclick="window.debugView?.switchTab('env')">环境信息</button>
      </div>

      <div class="debug-content">
        <div id="tab-timeline" class="tab-content"></div>
        <div id="tab-logs" class="tab-content hidden"></div>
        <div id="tab-env" class="tab-content hidden"></div>
      </div>
    `;

    this.renderTimeline();
    this.renderLogs();
    this.renderEnv();

    // Set up live log listener
    this.logListener = logger.onEntry(() => {
      if (this.currentTab === 'logs') {
        this.renderLogs();
      }
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    app.switchTab(tabName);
  }

  renderTimeline() {
    const container = document.getElementById('tab-timeline');
    if (!container) return;

    const ops = logger.getOperations ? logger.getOperations() : [];

    if (ops.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无操作记录<br>发送消息后会显示执行步骤</div>';
      return;
    }

    container.innerHTML = ops.map((op, i) => `
      <div class="timeline-item">
        <div class="timeline-step">${i + 1}</div>
        <div class="timeline-content">
          <div class="timeline-time">${format.time(op.timestamp)}</div>
          <div class="timeline-type">${escHtml(op.type)}</div>
          <div class="timeline-detail">${escHtml(op.detail)}</div>
        </div>
      </div>
    `).join('');
  }

  renderLogs() {
    const container = document.getElementById('tab-logs');
    if (!container) return;

    const logs = logger.getBuffer();

    container.innerHTML = `
      <div class="log-filters">
        <button class="log-filter active" onclick="window.debugView?.filterLogs('all', this)">全部</button>
        <button class="log-filter" onclick="window.debugView?.filterLogs('error', this)">错误</button>
        <button class="log-filter" onclick="window.debugView?.filterLogs('warn', this)">警告</button>
      </div>
      <div class="log-entries">
        ${logs.length === 0
          ? '<div class="empty-state">暂无日志<br>操作后会记录日志</div>'
          : logs.map(log => `
            <div class="log-entry ${log.level}">
              <span class="log-time">${format.time(log.timestamp)}</span>
              <span class="log-level">[${log.level.toUpperCase()}]</span>
              <span class="log-source">[${log.source}]</span>
              <span class="log-message">${escHtml(log.message)}</span>
            </div>
          `).join('')
        }
      </div>
    `;
  }

  filterLogs(level, btn) {
    document.querySelectorAll('.log-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const logs = level === 'all' ? logger.getBuffer() : logger.getFiltered(level);
    const container = document.querySelector('#tab-logs .log-entries');

    container.innerHTML = logs.length === 0
      ? '<div class="empty-state">无匹配日志</div>'
      : logs.map(log => `
        <div class="log-entry ${log.level}">
          <span class="log-time">${format.time(log.timestamp)}</span>
          <span class="log-level">[${log.level.toUpperCase()}]</span>
          <span class="log-source">[${log.source}]</span>
          <span class="log-message">${escHtml(log.message)}</span>
        </div>
      `).join('');
  }

  renderEnv() {
    const container = document.getElementById('tab-env');
    if (!container) return;

    container.innerHTML = `
      <div class="env-info">
        <h3 style="margin-top:0">环境信息</h3>
        <div class="env-item">
          <span class="env-label">wind-cli</span>
          <span class="env-value">${document.getElementById('windcli-version').textContent}</span>
        </div>
        <div class="env-item">
          <span class="env-label">API</span>
          <span class="env-value">${api.baseUrl}<br>模型: ${api.model}</span>
        </div>
        <div class="env-item">
          <span class="env-label">状态</span>
          <span class="env-value">${document.getElementById('env-status').textContent}</span>
        </div>
        <div class="env-item">
          <span class="env-label">工作区文件</span>
          <span class="env-value">${app.workspaceFiles.length} 个文件</span>
        </div>
        <div class="env-item">
          <span class="env-label">日志条数</span>
          <span class="env-value">${logger.getBuffer().length}</span>
        </div>
      </div>
    `;
  }

  destroy() {
    if (this.logListener) {
      this.logListener();
    }
  }
}
