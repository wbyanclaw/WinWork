// Upgrade Component - 组件化的升级功能
class UpgradeComponent {
  constructor() {
    this.modal = document.getElementById('upgrade-modal');
    this.pollInterval = null;
  }

  openModal() {
    this.modal.classList.remove('hidden');
    document.getElementById('upgrade-version-info').innerHTML = '检查中...';
    document.getElementById('upgrade-progress-bar').style.width = '0%';
    document.getElementById('upgrade-logs').innerHTML = '';
  }

  closeModal() {
    this.modal.classList.add('hidden');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  setProgress(percent) {
    document.getElementById('upgrade-progress-bar').style.width = `${percent}%`;
  }

  setStatus(text, type) {
    const el = document.getElementById('upgrade-status');
    el.textContent = text;
    el.className = `upgrade-status ${type}`;
  }

  setVersionInfo(text) {
    document.getElementById('upgrade-version-info').innerHTML = text;
  }

  setLogs(html) {
    document.getElementById('upgrade-logs').innerHTML = html;
  }

  async check() {
    this.openModal();
    this.setStatus('正在检查更新...', 'progress');
    this.setProgress(10);

    try {
      const result = await invoke('check_upgrade');
      logger.info('upgrade', `Check: ${JSON.stringify(result)}`);

      if (result.ok && result.data) {
        const hasUpdate = result.data.has_update === 'true';
        const current = result.data.current_version || 'unknown';
        const latest = result.data.latest_version || 'unknown';

        if (hasUpdate) {
          this.setVersionInfo(
            `<span style="color:#94a3b8">当前版本: <b>${current}</b></span>` +
            ` <span style="color:#64748b">→</span> ` +
            `<span style="color:#22c55e">最新版本: <b>${latest}</b></span>`
          );
          this.setProgress(30);
          this.setStatus('发现新版本! 点击下方按钮开始升级', 'ready');
          this.setLogs(`<div class="upgrade-btn-container"><button class="upgrade-action-btn" onclick="upgradeComponent.perform()">🚀 开始升级</button></div>`);
        } else {
          this.setProgress(100);
          this.setStatus('当前已是最新版本', 'complete');
          this.setVersionInfo(`wind-cli ${current} (最新)`);
        }
      } else {
        this.setProgress(100);
        this.setStatus('检查失败', 'error');
      }
    } catch (e) {
      this.setProgress(100);
      this.setStatus(`检查失败: ${e.message}`, 'error');
      logger.error('upgrade', `Check failed: ${e.message}`);
    }
  }

  async perform() {
    this.setProgress(5);
    this.setStatus('正在执行升级...', 'progress');
    this.setLogs('<div style="color:#94a3b8">准备中...</div>');
    logger.info('upgrade', 'Starting upgrade...');

    const unlisten = await window.__TAURI__.event.listen('upgrade-complete', (event) => {
      unlisten();
      this.onComplete(event.payload);
    });

    try {
      await invoke('do_upgrade');

      this.pollInterval = setInterval(async () => {
        try {
          const data = await invoke('get_upgrade_progress');
          const progress = JSON.parse(data);

          this.setProgress(progress.percent);
          this.setStatus(progress.stage, 'progress');

          if (progress.log && progress.log.length > 0) {
            this.setLogs(progress.log.map(l =>
              `<div style="color:#94a3b8;font-size:11px">${l}</div>`
            ).join(''));
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 500);
    } catch (e) {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.setProgress(100);
      this.setStatus(`❌ 升级失败: ${e.message}`, 'error');
      this.setLogs(`<div class="upgrade-terminal error">${e.message}</div>`);
      logger.error('upgrade', `Error: ${e.message}`);
    }
  }

  onComplete(result) {
    if (this.pollInterval) clearInterval(this.pollInterval);

    if (result.data?.manual_upgrade) {
      this.setProgress(100);
      this.setStatus('需手动升级', 'error');
      this.setLogs(`
        <div class="upgrade-terminal error">当前版本不支持自动升级</div>
        <a href="https://github.com/wbyanclaw/wind-cli/releases/latest" target="_blank">
          📥 前往 GitHub 下载最新版本
        </a>
      `);
      return;
    }

    if (result.ok) {
      this.setProgress(100);
      let newVersion = 'unknown';
      if (result.data?.version) {
        newVersion = result.data.version;
      } else {
        const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
        if (match) newVersion = match[1];
      }

      document.getElementById('windcli-version').textContent = `wind-cli ${newVersion}`;
      this.setStatus('✅ 升级完成!', 'complete');
      this.setVersionInfo(`<span style="color:#22c55e">✅ wind-cli ${newVersion}</span>`);
      this.setLogs(`<div class="upgrade-terminal">${result.stdout}</div>`);
      logger.info('upgrade', `Upgraded to: ${newVersion}`);
      setTimeout(() => this.closeModal(), 3000);
    } else {
      this.setProgress(100);
      this.setStatus('❌ 升级失败', 'error');
      this.setLogs(`<div class="upgrade-terminal error">${result.stderr || result.stdout}</div>`);
    }
  }
}

const upgradeComponent = new UpgradeComponent();
