// Lucide-style icons as inline SVG (no CDN dependency)
const icons = {
  chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,

  chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,

  folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,

  folderOpen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M2 10h20"></path></svg>`,

  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,

  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,

  copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,

  refreshCw: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,

  externalLink: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,

  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,

  archive: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="2"></rect><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"></path><path d="M10 13h4"></path></svg>`,

  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
};

class FilePanel {
  constructor() {
    this.panel = null;
    this.content = null;
    this.currentFile = null;
    this.currentMode = 'source'; // 'source' or 'preview'
    this.init();
  }

  init() {
    // Create panel if it doesn't exist
    if (!document.getElementById('file-panel')) {
      this.panel = document.createElement('div');
      this.panel.id = 'file-panel';
      this.panel.className = 'file-panel';
      this.panel.innerHTML = `
        <div class="file-panel-header">
          <div class="file-panel-title">
            ${icons.fileText}
            <span id="file-panel-name"></span>
          </div>
          <button class="file-panel-close" onclick="filePanel.close()">
            ${icons.x}
          </button>
        </div>
        <div class="file-panel-meta">
          <span id="file-panel-size"></span>
          <span id="file-panel-type" style="margin-left: 12px;"></span>
        </div>
        <div class="file-panel-tabs" id="file-panel-tabs" style="display: none;">
          <button class="file-panel-tab active" data-mode="source" onclick="filePanel.switchMode('source')">源码</button>
          <button class="file-panel-tab" data-mode="preview" onclick="filePanel.switchMode('preview')">预览</button>
        </div>
        <div class="file-panel-content" id="file-panel-content">
          <div id="file-panel-source" class="file-panel-source"></div>
          <div id="file-panel-preview" class="file-panel-preview markdown-body"></div>
          <iframe id="file-panel-html-iframe" class="html-preview-iframe" style="display: none;"></iframe>
        </div>
        <div class="file-panel-actions">
          <button class="file-panel-btn" onclick="filePanel.copyContent()">
            ${icons.copy}
            <span>复制内容</span>
          </button>
        </div>
      `;
      document.body.appendChild(this.panel);
    } else {
      this.panel = document.getElementById('file-panel');
    }
    this.content = document.getElementById('file-panel-content');
  }

  getFileType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const previewTypes = ['md', 'markdown', 'html', 'htm'];
    return previewTypes.includes(ext) ? ext : null;
  }

  open(file) {
    this.currentFile = file;
    const fileType = this.getFileType(file.name);

    document.getElementById('file-panel-name').textContent = file.name;
    document.getElementById('file-panel-size').textContent = this.formatSize(file.size);

    // Load content
    const loadContent = (content) => {
      const sourceEl = document.getElementById('file-panel-source');
      const previewEl = document.getElementById('file-panel-preview');
      const iframeEl = document.getElementById('file-panel-html-iframe');
      const tabsEl = document.getElementById('file-panel-tabs');

      sourceEl.textContent = content || '(空内容)';

      if (fileType === 'md' || fileType === 'markdown') {
        // Markdown file
        document.getElementById('file-panel-type').textContent = 'Markdown';
        tabsEl.style.display = 'flex';
        previewEl.innerHTML = typeof marked !== 'undefined' ? marked.parse(content) : '<pre>' + content + '</pre>';
        this.currentMode = 'preview';
        this.switchMode('preview');
      } else if (fileType === 'html' || fileType === 'htm') {
        // HTML file
        document.getElementById('file-panel-type').textContent = 'HTML';
        tabsEl.style.display = 'flex';
        // Create sandboxed iframe for HTML preview
        iframeEl.srcdoc = content;
        this.currentMode = 'preview';
        this.switchMode('preview');
      } else {
        // Other file types - hide tabs, show source only
        document.getElementById('file-panel-type').textContent = '';
        tabsEl.style.display = 'none';
        this.currentMode = 'source';
        this.switchMode('source');
      }
    };

    // If file has content already, display it directly
    if (file.content !== undefined) {
      loadContent(file.content);
    } else {
      // Load content via invoke
      invoke('read_file', { path: file.path }).then(result => {
        loadContent(result.stdout);
      });
    }
    this.panel.classList.add('open');
  }

  switchMode(mode) {
    this.currentMode = mode;
    const sourceEl = document.getElementById('file-panel-source');
    const previewEl = document.getElementById('file-panel-preview');
    const iframeEl = document.getElementById('file-panel-html-iframe');
    const tabs = document.querySelectorAll('.file-panel-tab');

    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    if (mode === 'source') {
      sourceEl.classList.add('active');
      previewEl.classList.remove('active');
      iframeEl.style.display = 'none';
    } else {
      sourceEl.classList.remove('active');
      const fileType = this.getFileType(this.currentFile?.name);
      if (fileType === 'html' || fileType === 'htm') {
        previewEl.classList.remove('active');
        iframeEl.style.display = 'block';
      } else {
        previewEl.classList.add('active');
        iframeEl.style.display = 'none';
      }
    }
  }

  close() {
    this.panel.classList.remove('open');
    this.currentFile = null;
    this.currentMode = 'source';
  }

  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  copyContent() {
    const content = this.currentFile?.content;
    if (content) {
      navigator.clipboard.writeText(content);
      const btn = document.querySelector('.file-panel-btn');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = originalHtml.replace(/<span>.*<\/span>/, '<span style="color:#22c55e">已复制!</span>');
      setTimeout(() => btn.innerHTML = originalHtml, 1500);
    }
  }
}

const filePanel = new FilePanel();

// 当前活动的面板
let currentPanel = 'workspace';
let wikiPath = null;

// Tree node state management
const treeState = new Map();
const wikiTreeState = new Map();

// 切换侧边栏面板
function switchFilePanel(panel) {
  currentPanel = panel;

  // 更新 tab 样式
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.panel === panel);
  });

  // 更新面板显示
  document.querySelectorAll('.sidebar-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${panel}`);
  });

  // 加载对应面板内容
  if (panel === 'wiki' && !wikiTreeState.size) {
    loadWikiTree();
  }
}

// 加载知识库树
async function loadWikiTree() {
  try {
    // 从设置获取 wiki 路径
    const path = wikiPath || (await invoke('get_wiki_path'));
    console.log('[tree] loadWikiTree path:', path);
    const result = await invoke('run_command', { args: ['--json', 'ls', path] });
    console.log('[tree] wiki ls result:', result);

    if (result.ok && result.data?.entries) {
      renderFileTree(result.data.entries, 'wiki-tree-root', 0, false, 'wiki');
    }
  } catch (e) {
    console.error('[tree] loadWikiTree failed:', e);
  }
}

// 设置 wiki 路径
function setWikiPath(path) {
  wikiPath = path;
}

// Load and render file tree
async function loadFileTree() {
  try {
    // Get workspace path from winwork config
    const wsPath = await invoke('get_workspace_path');
    console.log('[tree] wsPath:', wsPath);

    const result = await invoke('run_command', { args: ['--json', 'ls', wsPath] });
    console.log('[tree] ls result:', result);
    console.log('[tree] ok:', result.ok, 'data:', result.data, 'stdout:', result.stdout, 'stderr:', result.stderr);

    if (result.ok && result.data?.entries) {
      const entries = result.data.entries;
      console.log('[tree] entries count:', entries.length, entries);

      // 不再预加载子目录，按需加载（点击时再加载）
      renderFileTree(entries, 'file-tree-root', 0, false); // 不自动展开

      // Wiki 内容异步加载，不阻塞主线程
      const wikiPath = await invoke('get_wiki_path');
      console.log('[tree] wikiPath:', wikiPath, 'wsPath:', wsPath);
      loadWikiContent(wikiPath);
    } else {
      // 目录为空或不存在，渲染空状态
      console.log('[tree] No entries, rendering empty');
      renderFileTree([], 'file-tree-root', 0, false);
    }
  } catch (e) {
    console.error('[tree] loadFileTree failed:', e);
  }
}

async function loadWikiContent(wikiPath) {
  try {
    console.log('[tree] loadWikiContent wikiPath:', wikiPath);
    const result = await invoke('run_command', { args: ['--json', 'ls', wikiPath] });
    console.log('[tree] wiki content result:', result);
    if (result.ok && result.data?.entries) {
      wikiTreeState.set('tree-wiki', result.data.entries);
      // Also render wiki tree
      renderFileTree(result.data.entries, 'wiki-tree-root', 0, false, 'wiki');
    }
  } catch (e) {
    // Wiki may not exist yet
    console.error('Failed to load wiki:', e);
  }
}

function renderFileTree(entries, containerId, depth = 0, autoExpand = false, panelType = 'workspace') {
  console.log('[file-tree] renderFileTree called:', { entries, containerId, depth, panelType });
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[file-tree] Container not found:', containerId);
    return;
  }

  const treeKey = panelType === 'wiki' ? 'wiki' : 'workspace';

  if (!entries || entries.length === 0) {
    container.innerHTML = '<div style="padding:12px;color:var(--color-text-muted);font-size:12px">空目录</div>';
    return;
  }

  container.innerHTML = entries.map(entry => {
    const isDir = entry.type === 'dir';
    const id = `${panelType}-${btoa(entry.name).replace(/[/+=]/g, '_')}`;
    const paddingLeft = 12 + depth * 16;

    if (isDir) {
      const shouldAutoExpand = autoExpand && depth === 0;
      return `
        <div class="tree-node" data-name="${entry.name}" data-type="dir" data-id="${id}">
          <div class="tree-item ${shouldAutoExpand ? 'expanded' : ''}" style="padding-left:${paddingLeft}px" onclick="toggleTreeNode('${id}', '${entry.name}', '${entry.path || entry.name}', '${panelType}')">
            <span class="tree-chevron ${shouldAutoExpand ? 'expanded' : 'collapsed'}" id="${id}-chevron">${shouldAutoExpand ? icons.chevronDown : icons.chevronRight}</span>
            <span class="tree-icon">${shouldAutoExpand ? icons.folderOpen : icons.folder}</span>
            <span class="tree-name">${entry.name}</span>
          </div>
          <div class="tree-children ${shouldAutoExpand ? '' : 'hidden'}" id="${id}-children"></div>
        </div>
      `;
    } else {
      return `
        <div class="tree-node" data-name="${entry.name}" data-type="file">
          <div class="tree-item" style="padding-left:${paddingLeft}px" onclick="openFilePreview('${entry.name}', '${entry.path || ''}', '${panelType}')">
            <span class="tree-chevron"></span>
            <span class="tree-icon">${icons.fileText}</span>
            <span class="tree-name">${entry.name}</span>
          </div>
        </div>
      `;
    }
  }).join('');

  // 如果自动展开，加载子目录内容
  if (autoExpand && depth === 0) {
    for (const entry of entries) {
      if (entry.type === 'dir') {
        const id = `${panelType}-${btoa(entry.name).replace(/[/+=]/g, '_')}`;
        loadChildren(id, entry.path || entry.name, panelType);
      }
    }
  }
}

async function loadChildren(nodeId, dirPath, panelType = 'workspace') {
  const stateMap = panelType === 'wiki' ? wikiTreeState : treeState;

  try {
    const result = await invoke('run_command', { args: ['--json', 'ls', dirPath] });
    if (result.ok && result.data?.entries) {
      stateMap.set(nodeId, result.data.entries);
      const childrenEl = document.getElementById(`${nodeId}-children`);
      if (childrenEl && !childrenEl.classList.contains('hidden')) {
        renderFileTree(result.data.entries, `${nodeId}-children`, getTreeDepth(nodeId) + 1, false, panelType);
      }
    }
  } catch (e) {
    console.error('Failed to load directory:', e);
  }
}

async function toggleTreeNode(nodeId, dirName, dirPath, panelType = 'workspace') {
  const childrenEl = document.getElementById(`${nodeId}-children`);
  const chevronEl = document.getElementById(`${nodeId}-chevron`);
  const nodeEl = document.querySelector(`[data-id="${nodeId}"]`);
  const iconEl = nodeEl?.querySelector('.tree-icon');
  const itemEl = nodeEl?.querySelector('.tree-item');
  const stateMap = panelType === 'wiki' ? wikiTreeState : treeState;

  const path = dirPath || dirName;

  if (childrenEl.classList.contains('hidden')) {
    if (!stateMap.has(nodeId)) {
      await loadChildren(nodeId, path, panelType);
    }

    const children = stateMap.get(nodeId) || [];
    renderFileTree(children, `${nodeId}-children`, getTreeDepth(nodeId) + 1, false, panelType);
    childrenEl.classList.remove('hidden');
    chevronEl.classList.remove('collapsed');
    chevronEl.classList.add('expanded');
    chevronEl.innerHTML = icons.chevronDown;
    if (iconEl) iconEl.innerHTML = icons.folderOpen;
    if (itemEl) itemEl.classList.add('expanded');
  } else {
    childrenEl.classList.add('hidden');
    chevronEl.classList.remove('expanded');
    chevronEl.classList.add('collapsed');
    chevronEl.innerHTML = icons.chevronRight;
    if (iconEl) iconEl.innerHTML = icons.folder;
    if (itemEl) itemEl.classList.remove('expanded');
  }
}

function getTreeDepth(nodeId) {
  // Parse depth from padding or node structure
  const node = document.querySelector(`[data-id="${nodeId}"]`);
  if (!node) return 0;
  const item = node.querySelector('.tree-item');
  if (!item) return 0;
  const padding = parseInt(item.style.paddingLeft) || 12;
  return Math.floor((padding - 12) / 16) + 1;
}

async function openFilePreview(filename, filePath, panelType = 'workspace') {
  try {
    // 根据面板类型确定基础路径
    let basePath;
    let relativePath;
    if (panelType === 'wiki') {
      basePath = wikiPath || await invoke('get_wiki_path');
      // 对于 wiki，使用 --workspace 参数指定 wiki 目录
      const wikiPathEncoded = encodeURIComponent(basePath);
      relativePath = filename;
      console.log('[preview] Wiki file, will use --workspace:', basePath);
    } else {
      basePath = await invoke('get_workspace_path');
      relativePath = filename;
    }

    // wind-cli read 命令期望相对路径，只需要传文件名
    // read_file 会自动拼接工作区路径
    console.log('[preview] relativePath:', relativePath);

    // 直接调用 run_command，使用 --workspace 指定目录
    const wsPath = basePath.replace(/\\/g, '/');
    const result = await invoke('run_command', { args: ['--json', '--workspace', wsPath, 'read', relativePath] });
    if (result.ok) {
      filePanel.open({
        name: filename,
        path: `${basePath}\\${filename}`,
        content: result.data?.content || result.stdout,
        size: result.data?.size_bytes
      });
    } else {
      console.error('Failed to read file:', result);
    }
  } catch (e) {
    console.error('Failed to open file:', e);
  }
}

async function openInExplorer(panel) {
  const p = panel || currentPanel;
  if (p === 'wiki') {
    const path = wikiPath || await invoke('get_wiki_path');
    const fileUrl = 'file:///' + path.replace(/\\/g, '/');
    invoke('open_url', { url: fileUrl });
  } else {
    const path = await invoke('get_workspace_path');
    const fileUrl = 'file:///' + path.replace(/\\/g, '/');
    invoke('open_url', { url: fileUrl });
  }
}

async function refreshTree(panel) {
  const p = panel || currentPanel;
  if (p === 'wiki') {
    wikiTreeState.clear();
    loadWikiTree();
  } else {
    treeState.clear();
    loadFileTree();
  }
}