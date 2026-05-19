// 侧边栏组件
class Sidebar {
  constructor(container) {
    this.container = container;
  }

  render() {
    this.container.innerHTML = `
      <div class="sidebar-content">
        <div id="status-indicators" class="status-section"></div>

        <div class="divider"></div>

        <div class="actions-section">
          <button class="action-btn" onclick="app.openFolder()">
            <span class="icon">📂</span>
            <span class="label">打开文件夹</span>
          </button>
          <button class="action-btn" onclick="app.listFiles()">
            <span class="icon">📋</span>
            <span class="label">列出文件</span>
          </button>
          <button class="action-btn" onclick="app.newFile()">
            <span class="icon">📝</span>
            <span class="label">新建文件</span>
          </button>
          <button class="action-btn" onclick="app.openWiki()">
            <span class="icon">📚</span>
            <span class="label">知识库</span>
          </button>
        </div>

        <div class="divider"></div>

        <div class="tools-section">
          <button class="action-btn" onclick="app.openSettings()">
            <span class="icon">⚙️</span>
            <span class="label">设置</span>
          </button>
          <button class="action-btn" onclick="app.openDebug()">
            <span class="icon">🔧</span>
            <span class="label">诊断/日志</span>
          </button>
        </div>
      </div>
    `;

    // 初始化状态检查
    statusIndicator.render();
    statusIndicator.check();
  }
}
