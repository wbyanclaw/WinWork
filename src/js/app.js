// App - Main entry point, only coordinates components
class App {
  constructor() {
    this.chatView = new ChatView(document.getElementById('messages'));
    this.currentView = 'chat';
  }

  async init() {
    console.log('[DEBUG] app.init() called');
    logger.info('app', 'Initializing...');
    this.initUI();
    await this.checkEnv();
    await this.initTools();
    this.initFileTree();
    await this.chatView.loadHistory();
    logger.info('app', 'Ready');
  }

  async initFileTree() {
    try {
      console.log('[DEBUG] Loading file tree...');
      logger.info('app', 'Loading file tree...');
      await loadFileTree();
      console.log('[DEBUG] File tree loaded');
      logger.info('app', 'File tree loaded');
    } catch (e) {
      console.error('[ERROR] Failed to load file tree:', e);
      logger.error('app', 'Failed to load file tree: ' + e.message);
    }
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

    this.showWelcome();
  }

  showWelcome() {
    const container = document.getElementById('messages');
    container.innerHTML = `
      <div class="Welcome">
        <div class="Welcome-icon">⚡</div>
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

  hideWelcome() {
    const welcome = document.querySelector('.Welcome');
    if (welcome) welcome.remove();
  }

  async checkEnv() {
    try {
      const wwVersion = await invoke('get_winwork_version');
      document.getElementById('winwork-version').textContent = `winwork ${wwVersion}`;
    } catch (e) {
      document.getElementById('winwork-version').textContent = 'winwork';
    }

    try {
      const result = await invoke('run_command', { args: ['--version'] });
      if (result.ok) {
        const version = result.stdout.trim();
        document.getElementById('windcli-version').textContent = `wind-cli ${version.replace('wind ', '')}`;
        document.getElementById('env-status').innerHTML = '<span style="color:#059669">●</span> 就绪';
        document.getElementById('env-status').className = 'env-status ready';
      }
    } catch (e) {
      document.getElementById('windcli-version').textContent = 'wind-cli 未安装';
      document.getElementById('env-status').innerHTML = '<span style="color:#dc2626">●</span> wind-cli 未就绪';
      document.getElementById('env-status').className = 'env-status error';
    }

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

  async initTools() {
    try {
      const listResult = await invoke('run_command', { args: ['--json', 'tools', 'list'] });
      const data = JSON.parse(listResult.stdout);
      const tools = data.tools || [];

      const toolDefs = [];
      for (const tool of tools) {
        try {
          const descResult = await invoke('run_command', { args: ['--json', 'tools', 'describe', tool.name] });
          const desc = JSON.parse(descResult.stdout).tool;
          toolDefs.push(convertToOpenAITool(desc));
        } catch (e) {
          console.warn('[app] Tool description failed:', tool.name);
        }
      }

      await api.initTools(toolDefs);
      logger.info('app', `Loaded ${toolDefs.length} tools`);
    } catch (e) {
      console.error('[app] Failed to init tools:', e);
      await api.initTools([]);
    }
  }

  async send() {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this.hideWelcome();

    this.chatView.appendUser(text);
    logger.info('user', text);

    if (!api.apiKey) {
      this.chatView.appendAi('⚠️ 请先点击右上角 ⚙️ 设置 API Key');
      return;
    }

    this.chatView.appendThinking();

    api.onToolCall = async (name, args) => {
      const toolCall = {
        tool: name,
        args: args,
        timestamp: new Date().toISOString()
      };
      logger.info('tool', JSON.stringify(toolCall));
      let result;
      if (name === 'help') {
        const cmd = args.command || '';
        result = await invoke('run_command', {
          args: cmd ? ['--json', cmd, '--help'] : ['--json', '--help']
        });
      } else {
        result = await invoke('run_command', {
          args: ['--json', 'tools', 'call', name, '--params', JSON.stringify(args)]
        });
      }
      logger.info('tool', `Result: ${result.ok ? 'OK' : 'FAILED'}`);
      return result;
    };

    try {
      const response = await api.chat(text);
      this.chatView.removeThinking();
      this.chatView.appendAi(response);
      refreshTree();
    } catch (e) {
      this.chatView.removeThinking();
      const errorMsg = e.message.includes('Failed to fetch')
        ? '❌ API 请求失败，请检查网络和 API 配置'
        : `❌ 错误: ${e.message}`;
      this.chatView.appendAi(errorMsg);
      logger.error('api', e.message);
    }

    api.onToolCall = null;
  }

  // Debug View
  openDebug() {
    this.currentView = 'debug';
    document.getElementById('messages').classList.add('hidden');
    debugComponent.render();
  }

  closeDebug() {
    this.currentView = 'chat';
    document.getElementById('messages').classList.remove('hidden');
    debugComponent.close();
  }

  switchTab(tabName) {
    document.querySelectorAll('.debug-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== `tab-${tabName}`);
    });
  }

  newChat() {
    this.chatView.clear();
    this.showWelcome();
  }
}

const app = new App();

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
