// 状态指示器
class StatusIndicator {
  constructor() {
    this.state = {
      windcli: 'loading',
      api: 'loading'
    };
    this.details = {};
  }

  update(type, status, details = {}) {
    this.state[type] = status;
    this.details[type] = details;
    this.render();
  }

  async check() {
    // 检查 wind-cli 状态
    try {
      const result = await invoke('run_command', { args: ['--version'] });
      if (result.ok) {
        this.update('windcli', 'ready', { version: result.stdout.trim() });
      } else {
        this.update('windcli', 'error', { message: 'wind-cli not found' });
      }
    } catch (e) {
      this.update('windcli', 'error', { message: e.message });
    }

    // 检查 API 状态
    if (api.apiKey) {
      this.update('api', 'ready', { model: api.model });
    } else {
      this.update('api', 'error', { message: 'API not configured' });
    }
  }

  render() {
    const container = document.getElementById('status-indicators');
    if (!container) return;

    container.innerHTML = `
      <div class="status-item ${this.state.windcli}" onclick="statusIndicator.toggleDetails('windcli')">
        <span class="status-dot ${this.state.windcli}"></span>
        <span class="status-text">wind-cli: ${this.getLabel(this.state.windcli)}</span>
      </div>
      <div class="status-item ${this.state.api}" onclick="statusIndicator.toggleDetails('api')">
        <span class="status-dot ${this.state.api}"></span>
        <span class="status-text">API: ${this.getLabel(this.state.api)}</span>
      </div>
    `;
  }

  getLabel(status) {
    const labels = { ready: '就绪', loading: '加载中', error: '未就绪' };
    return labels[status] || status;
  }

  toggleDetails(type) {
    // TODO: 显示详情弹窗
  }
}

const statusIndicator = new StatusIndicator();
