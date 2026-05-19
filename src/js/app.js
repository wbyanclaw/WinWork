// 应用入口
class App {
  constructor() {
    this.chatView = new ChatView(document.getElementById('messages'));
    this.sidebar = new Sidebar(document.getElementById('sidebar'));
    this.debugView = new DebugView(document.getElementById('debug-view'));
    this.currentView = 'chat'; // 'chat' | 'debug'
  }

  async init() {
    logger.info('app', 'Initializing...');

    // 初始化侧边栏
    this.sidebar.render();

    // 检查环境
    await statusIndicator.check();

    logger.info('app', 'Ready');
  }

  async send() {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    // 添加用户消息
    this.chatView.appendUser(text);

    // 如果没有 API key，提示配置
    if (!api.apiKey) {
      this.chatView.appendAi('请先在设置中配置 API Key');
      return;
    }

    // 显示思考中
    this.chatView.appendThinking();

    try {
      // 调用 AI
      logger.info('api', `Sending: ${text}`);
      const response = await api.chat(text);

      // 移除思考中
      this.chatView.removeThinking();

      // 显示 AI 响应
      this.chatView.appendAi(response);

      // 解析并执行命令
      const commands = commandParser.parse(response);
      if (commands.length > 0) {
        this.debugView.addOperation('AI 响应', `解析到 ${commands.length} 个命令`);

        const results = [];
        for (const cmd of commands) {
          this.debugView.addOperation('执行', `$ wind ${cmd.raw}`);
          const result = await commandExecutor.execute(cmd.raw);
          results.push({ ...cmd, ...result });
        }

        // 显示结果卡片
        const cardHtml = ResultCard.render(results);
        this.chatView.appendResult(cardHtml);

        // 记录到日志
        logger.info('wind', `Executed ${results.length} commands`);
      }
    } catch (e) {
      this.chatView.removeThinking();
      this.chatView.appendResult(ResultCard.renderError(e.message));
      logger.error('app', `Error: ${e.message}`);
    }
  }

  // 侧边栏操作
  async openFolder() {
    try {
      const result = await invoke('select_folder');
      if (result.ok) {
        logger.info('app', `Opened folder: ${result.stdout}`);
      }
    } catch (e) {
      logger.error('app', `Failed to open folder: ${e.message}`);
    }
  }

  async listFiles() {
    try {
      const result = await invoke('list_files');
      this.chatView.appendResult(ResultCard.render([{ raw: 'ls', ...result }]));
    } catch (e) {
      logger.error('app', `Failed to list files: ${e.message}`);
    }
  }

  async newFile() {
    // TODO: 实现新建文件对话框
    logger.info('app', 'New file requested');
  }

  async openWiki() {
    try {
      const wikiPath = await invoke('get_workspace_path');
      const wikiResult = await commandExecutor.executeWithArgs(['wiki', 'status']);
      this.chatView.appendResult(ResultCard.render([{ raw: 'wiki status', ...wikiResult }]));
    } catch (e) {
      logger.error('app', `Failed to open wiki: ${e.message}`);
    }
  }

  // 设置
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
    api.baseUrl = document.getElementById('api-base-url').value.trim();
    api.model = document.getElementById('api-model').value.trim();
    const key = document.getElementById('api-key').value.trim();
    if (key) api.saveApiKey(key);

    localStorage.setItem('winwork_api_base_url', api.baseUrl);
    localStorage.setItem('winwork_api_model', api.model);

    statusIndicator.update('api', api.apiKey ? 'ready' : 'error');
    this.closeSettings();
    logger.info('app', 'Settings saved');
  }

  // 调试视图
  openDebug() {
    this.currentView = 'debug';
    document.getElementById('messages').classList.add('hidden');
    document.getElementById('debug-view').classList.remove('hidden');
    this.debugView.render();
  }

  closeDebug() {
    this.currentView = 'chat';
    document.getElementById('messages').classList.remove('hidden');
    document.getElementById('debug-view').classList.add('hidden');
  }
}

// 全局实例
const app = new App();

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  app.init();

  // 输入框回车发送
  document.getElementById('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      app.send();
    }
  });
});