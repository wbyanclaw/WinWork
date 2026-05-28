// Settings Component - 组件化的设置功能
class SettingsComponent {
  constructor() {
    this.modal = document.getElementById('settings-modal');
  }

  open() {
    this.modal.classList.remove('hidden');
    this.loadPaths();
    this.loadApiConfig();
  }

  close() {
    this.modal.classList.add('hidden');
  }

  async loadPaths() {
    try {
      const wsPath = await invoke('get_workspace_path');
      document.getElementById('workspace-path').value = wsPath;
    } catch (e) {
      console.error('Failed to get workspace path:', e);
    }

    try {
      const wikiPath = await invoke('get_wiki_path');
      document.getElementById('wiki-path').value = wikiPath;
    } catch (e) {
      console.error('Failed to get wiki path:', e);
    }
  }

  loadApiConfig() {
    document.getElementById('api-base-url').value = api.baseUrl;
    document.getElementById('api-key').value = api.apiKey;
    document.getElementById('api-model').value = api.model;
  }

  async selectWorkspacePath() {
    try {
      const result = await invoke('select_folder');
      if (result.ok && result.stdout) {
        document.getElementById('workspace-path').value = result.stdout;
      }
    } catch (e) {
      console.error('Failed to select folder:', e);
    }
  }

  async selectWikiPath() {
    try {
      const result = await invoke('select_folder');
      if (result.ok && result.stdout) {
        document.getElementById('wiki-path').value = result.stdout;
      }
    } catch (e) {
      console.error('Failed to select wiki folder:', e);
    }
  }

  async save() {
    const workspacePath = document.getElementById('workspace-path').value.trim();
    const wikiPath = document.getElementById('wiki-path').value.trim();
    const baseUrl = document.getElementById('api-base-url').value.trim();
    const model = document.getElementById('api-model').value.trim();
    const key = document.getElementById('api-key').value.trim();

    const defaultUrl = 'https://platform.minimax.com/v1';
    const defaultModel = 'abab6.5s-chat';

    // Save workspace path
    if (workspacePath) {
      try {
        await invoke('set_workspace_path', { path: workspacePath });
        refreshTree('workspace');
      } catch (e) {
        console.error('Failed to save workspace path:', e);
      }
    }

    // Save wiki path
    if (wikiPath) {
      try {
        const config = await invoke('load_config');
        config.wikiPath = wikiPath;
        await invoke('save_config', { config });
        setWikiPath(wikiPath);
        refreshTree('wiki');
      } catch (e) {
        console.error('Failed to save wiki path:', e);
      }
    }

    // Update API
    api.baseUrl = baseUrl || defaultUrl;
    api.model = model || defaultModel;
    if (key) {
      api.saveApiKey(key);
      api.apiKey = key;
    }

    localStorage.setItem('winwork_api_base_url', api.baseUrl);
    localStorage.setItem('winwork_api_model', api.model);

    app.updateApiStatus();
    this.close();
    logger.info('settings', `Saved: ws=${workspacePath}, wiki=${wikiPath}`);
  }
}

const settingsComponent = new SettingsComponent();
