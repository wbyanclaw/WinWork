// 应用入口
class App {
  constructor() {
    this.chatView = new ChatView(document.getElementById('messages'));
    this.currentView = 'chat';
  }

  async init() {
    logger.info('app', 'Initializing...');
    this.initUI();
    await this.checkEnv();
    loadFileTree(); // Load file tree on startup
    await this.chatView.loadHistory(); // Load chat history on startup
    logger.info('app', 'Ready');
  }

  initUI() {
    // Tab switching
    document.querySelectorAll('.debug-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Input enter key
    document.getElementById('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // Show welcome screen
    this.showWelcome();
  }

  showWelcome() {
    const container = document.getElementById('messages');
    const apiStatus = api.apiKey ? `API: ${api.model}` : '请先配置 API';
    container.innerHTML = `
      <div class="welcome">
        <div class="welcome-icon">${icons.archive}</div>
        <h2>WinWork</h2>
        <p>描述你的需求，AI 将自动完成文件操作</p>
        <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:12px;text-align:left;max-width:400px">
          <div style="font-size:13px;font-weight:500;margin-bottom:12px">使用指南：</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:8px">1. 左侧点击文件夹展开查看文件</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:8px">2. 输入框描述需求，AI 自动执行</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:8px">3. AI 生成的文件会保存到工作区</div>
          <div style="font-size:12px;color:#64748b">4. 文档会自动索引到知识库</div>
        </div>
        ${!api.apiKey ? '<div style="margin-top:16px;color:#d97706;font-size:13px">⚠️ 请先点击右上角 ⚙️ 设置 API</div>' : ''}
      </div>
    `;
  }

  async checkEnv() {
    // Check winwork version
    try {
      const wwVersion = await invoke('get_winwork_version');
      document.getElementById('winwork-version').textContent = `winwork ${wwVersion}`;
    } catch (e) {
      document.getElementById('winwork-version').textContent = 'winwork';
    }

    // Check wind-cli - always run fresh command to get actual version
    try {
      const result = await invoke('run_command', { args: ['--version'] });
      if (result.ok) {
        const version = result.stdout.trim();
        document.getElementById('windcli-version').textContent = `wind-cli ${version.replace('wind ', '')}`;
        document.getElementById('env-status').innerHTML = '<span style="color:#059669">●</span> 就绪';
        document.getElementById('env-status').className = 'env-status ready';
        logger.info('app', `wind-cli ready: ${version}`);
      } else {
        throw new Error('wind-cli not found');
      }
    } catch (e) {
      document.getElementById('windcli-version').textContent = 'wind-cli 未安装';
      document.getElementById('env-status').innerHTML = '<span style="color:#dc2626">●</span> wind-cli 未就绪';
      document.getElementById('env-status').className = 'env-status error';
      logger.error('app', `wind-cli error: ${e.message}`);
    }

    // Check API
    this.updateApiStatus();
  }

  updateApiStatus() {
    const statusEl = document.getElementById('env-status');
    if (api.apiKey) {
      statusEl.innerHTML = '<span style="color:#059669">●</span> 就绪 | ' + api.model;
      statusEl.className = 'env-status ready';
    } else {
      statusEl.innerHTML = '<span style="color:#d97706">●</span> 未配置 API';
      statusEl.className = 'env-status';
    }
  }

  async checkUpgrade() {
    this.openUpgradeModal();
    this.updateUpgradeStatus('正在检查更新...', 'progress');
    this.updateUpgradeProgress(10);

    try {
      const result = await invoke('check_upgrade');
      logger.info('upgrade', `Check result: ${JSON.stringify(result)}`);

      if (result.ok && result.data) {
        const hasUpdate = result.data.has_update === 'true';
        if (hasUpdate) {
          const current = result.data.current_version || '';
          const latest = result.data.latest_version || '';
          document.getElementById('upgrade-version-info').innerHTML =
            `<span style="color:#94a3b8">当前版本: <b>${current}</b></span>` +
            ` <span style="color:#64748b">→</span> ` +
            `<span style="color:#22c55e">最新版本: <b>${latest}</b></span>`;
          this.updateUpgradeProgress(30);
          this.updateUpgradeStatus('发现新版本! 点击下方按钮开始升级', 'ready');

          // Show upgrade button
          const logsEl = document.getElementById('upgrade-logs');
          logsEl.innerHTML = `<button class="btn-primary" onclick="app.performUpgrade()" style="width:100%;margin-top:16px">开始升级</button>`;
        } else {
          this.updateUpgradeProgress(100);
          this.updateUpgradeStatus('当前已是最新版本', 'complete');
          document.getElementById('upgrade-version-info').textContent = `wind-cli ${current || 'unknown'} (最新)`;
        }
      } else {
        this.updateUpgradeProgress(100);
        this.updateUpgradeStatus('检查失败', 'error');
      }
    } catch (e) {
      this.updateUpgradeProgress(100);
      this.updateUpgradeStatus(`检查失败: ${e.message}`, 'error');
      logger.error('upgrade', `Check failed: ${e.message}`);
    }
  }

  updateUpgradeProgress(percent) {
    document.getElementById('upgrade-progress-bar').style.width = `${percent}%`;
  }

  updateUpgradeStatus(text, type) {
    const el = document.getElementById('upgrade-status');
    el.textContent = text;
    el.className = `upgrade-status ${type}`;
  }

  openUpgradeModal() {
    document.getElementById('upgrade-modal').classList.remove('hidden');
    document.getElementById('upgrade-version-info').innerHTML = '检查中...';
    document.getElementById('upgrade-progress-bar').style.width = '0%';
    document.getElementById('upgrade-logs').innerHTML = '';
  }

  closeUpgradeModal() {
    document.getElementById('upgrade-modal').classList.add('hidden');
  }

  async performUpgrade() {
    this.updateUpgradeProgress(5);
    this.updateUpgradeStatus('正在执行升级...', 'progress');
    document.getElementById('upgrade-logs').innerHTML = '<div style="color:#94a3b8">准备中...</div>';
    logger.info('upgrade', 'Starting upgrade...');

    // Listen for completion event
    const unlisten = await window.__TAURI__.event.listen('upgrade-complete', async (event) => {
      unlisten();
      this.handleUpgradeComplete(event.payload);
    });

    try {
      // Start upgrade in background (non-blocking)
      await invoke('do_upgrade');

      // Poll for progress updates
      this.upgradePollInterval = setInterval(async () => {
        try {
          const progressData = await invoke('get_upgrade_progress');
          const progress = JSON.parse(progressData);

          this.updateUpgradeProgress(progress.percent);
          this.updateUpgradeStatus(progress.stage, 'progress');

          // Update logs
          if (progress.log && progress.log.length > 0) {
            const logsEl = document.getElementById('upgrade-logs');
            logsEl.innerHTML = progress.log.map(l =>
              `<div style="color:#94a3b8;font-size:11px">${l}</div>`
            ).join('');
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 500);

    } catch (e) {
      clearInterval(this.upgradePollInterval);
      this.updateUpgradeProgress(100);
      this.updateUpgradeStatus(`❌ 升级失败: ${e.message}`, 'error');
      this.updateUpgradeLogs(e.message);
      logger.error('upgrade', `Upgrade error: ${e.message}`);
    }
  }

  handleUpgradeComplete(result) {
    clearInterval(this.upgradePollInterval);

    // Check if manual upgrade is required
    if (result.data && result.data.manual_upgrade) {
      this.updateUpgradeProgress(100);
      this.updateUpgradeStatus('⚠️ 需手动升级', 'error');
      document.getElementById('upgrade-logs').innerHTML = `
        <div style="color:#f59e0b;margin-bottom:12px">当前版本不支持自动升级</div>
        <a href="https://github.com/wbyanclaw/wind-cli/releases/latest" target="_blank"
           style="color:#3b82f6;font-size:12px">点击下载最新版本 →</a>
      `;
      return;
    }

    if (result.ok) {
      this.updateUpgradeProgress(100);

      // Extract version from result
      let newVersion = 'unknown';
      if (result.data && result.data.version) {
        newVersion = result.data.version;
      } else {
        const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
        if (match) newVersion = match[1];
      }

      // Update UI with new version
      document.getElementById('windcli-version').textContent = `wind-cli ${newVersion}`;

      this.updateUpgradeStatus('✅ 升级完成!', 'complete');
      this.updateUpgradeVersionInfo(`wind-cli ${newVersion}`);

      // Show final logs
      document.getElementById('upgrade-logs').innerHTML = `<pre style="margin:0;font-size:11px;color:#22c55e;white-space:pre-wrap">${result.stdout}</pre>`;

      logger.info('upgrade', `Upgraded to: ${newVersion}`);

      setTimeout(() => this.closeUpgradeModal(), 3000);
    } else {
      this.updateUpgradeProgress(100);
      this.updateUpgradeStatus('❌ 升级失败', 'error');
      this.updateUpgradeLogs(result.stderr || result.stdout);
    }
  }

  updateUpgradeVersionInfo(text) {
    document.getElementById('upgrade-version-info').innerHTML = `<span style="color:#22c55e">✅ ${text}</span>`;
  }

  updateUpgradeLogs(text) {
    document.getElementById('upgrade-logs').innerHTML = `<pre style="margin:0;font-size:11px;color:#ef4444;white-space:pre-wrap">${text}</pre>`;
  }

  async send() {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this.hideWelcome();

    // Add user message
    this.chatView.appendUser(text);
    logger.info('user', text);

    // Check API key
    if (!api.apiKey) {
      this.chatView.appendAi('⚠️ 请先点击右上角 ⚙️ 设置 API Key');
      return;
    }

    // Show thinking
    this.chatView.appendThinking();

    try {
      logger.info('api', 'Calling AI...');
      const response = await api.chat(text);
      logger.info('api', 'AI response received');

      this.chatView.removeThinking();
      this.chatView.appendAi(response);

      // Parse and execute commands
      const commands = commandParser.parse(response);
      if (commands.length > 0) {
        logger.addOperation('AI 解析', `发现 ${commands.length} 个命令`);

        const results = [];
        for (const cmd of commands) {
          logger.addOperation('执行', `$ wind ${cmd.raw}`);
          logger.info('wind', `Executing: ${cmd.raw}`);

          const result = await commandExecutor.execute(cmd.raw, cmd.stdin);
          results.push({ ...cmd, ...result });

          logger.info('wind', `Result: ${result.ok ? 'OK' : 'FAIL'} - ${result.stdout || result.stderr}`);
        }

        // Show result card
        const cardHtml = ResultCard.render(results);
        this.chatView.appendResult(cardHtml);

        // Refresh file tree if needed
        const hasWrite = results.some(r => commandParser.extractWritePath(r.raw));
        if (hasWrite) {
          refreshTree();
        }
      }
    } catch (e) {
      this.chatView.removeThinking();
      const errorMsg = e.message.includes('Failed to fetch')
        ? '❌ API 请求失败，请检查网络和 API 配置'
        : `❌ 错误: ${e.message}`;
      this.chatView.appendAi(errorMsg);
      logger.error('api', `Error: ${e.message}`);
    }
  }

  hideWelcome() {
    const welcome = document.querySelector('.welcome');
    if (welcome) welcome.remove();
  }

  async runCommand(cmdStr) {
    try {
      const result = await commandExecutor.execute(cmdStr);
      const cardHtml = ResultCard.render([{ raw: cmdStr, ...result }]);
      this.chatView.appendResult(cardHtml);
    } catch (e) {
      this.chatView.appendAi(`❌ 命令执行失败: ${e.message}`);
    }
  }

  // Settings
  openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('api-base-url').value = api.baseUrl;
    document.getElementById('api-key').value = api.apiKey;
    document.getElementById('api-model').value = api.model;
  }

  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  }

  saveSettings() {
    const baseUrl = document.getElementById('api-base-url').value.trim();
    const model = document.getElementById('api-model').value.trim();
    const key = document.getElementById('api-key').value.trim();

    // Default values
    const defaultUrl = 'https://platform.minimax.com/v1';
    const defaultModel = 'abab6.5s-chat';

    // Update api object
    api.baseUrl = baseUrl || defaultUrl;
    api.model = model || defaultModel;
    if (key) {
      api.saveApiKey(key);
      api.apiKey = key;
    }

    // Also update localStorage directly for persistence
    localStorage.setItem('winwork_api_base_url', api.baseUrl);
    localStorage.setItem('winwork_api_model', api.model);

    this.updateApiStatus();
    this.closeSettings();
    logger.info('app', `Settings saved: API ${api.apiKey ? 'configured' : 'not configured'}`);
  }

  // Debug View
  openDebug() {
    this.currentView = 'debug';
    document.getElementById('messages').classList.add('hidden');
    document.getElementById('debug-view').classList.remove('hidden');
    document.getElementById('debug-view').classList.add('flex');
    window.debugView = new DebugView(document.getElementById('debug-view'));
    window.debugView.render();
    logger.info('app', 'Opened debug view');
  }

  closeDebug() {
    this.currentView = 'chat';
    document.getElementById('messages').classList.remove('hidden');
    document.getElementById('debug-view').classList.add('hidden');
    document.getElementById('debug-view').classList.remove('flex');
  }

  switchTab(tabName) {
    document.querySelectorAll('.debug-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== `tab-${tabName}`);
    });
  }

  clearLogs() {
    logger.clear();
    window.debugView?.render();
  }

  newChat() {
    this.chatView.clear();
    this.showWelcome();
  }
}

// Window controls
async function winMinimize() {
  try {
    const win = await window.__TAURI__.window.getCurrentWindow();
    await win.minimize();
  } catch (e) {
    console.error('Minimize failed:', e);
  }
}

async function winMaximize() {
  try {
    const win = await window.__TAURI__.window.getCurrentWindow();
    const isMaximized = await win.isMaximized();
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  } catch (e) {
    console.error('Maximize failed:', e);
  }
}

async function winClose() {
  try {
    const win = await window.__TAURI__.window.getCurrentWindow();
    await win.close();
  } catch (e) {
    console.error('Close failed:', e);
  }
}

// Global instances
const app = new App();
let debugView = null;

// Init on load
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
