// Lucide-style icons as inline SVG (no CDN dependency)
const icons = {
  chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,

  chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,

  folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,

  folderOpen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M2 10h20"></path></svg>`,

  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,

  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,

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
        </div>
        <div class="file-panel-content" id="file-panel-content">
          <pre id="file-panel-body"></pre>
        </div>
        <div class="file-panel-actions">
          <button class="file-panel-btn" onclick="filePanel.copyContent()">
            ${icons.fileText}
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

  open(file) {
    this.panel.classList.add('open');
    document.getElementById('file-panel-name').textContent = file.name;
    document.getElementById('file-panel-size').textContent = this.formatSize(file.size);
    document.getElementById('file-panel-body').textContent = file.content || '(空内容)';
    this.currentFile = file;
  }

  close() {
    this.panel.classList.remove('open');
    this.currentFile = null;
  }

  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  copyContent() {
    if (this.currentFile?.content) {
      navigator.clipboard.writeText(this.currentFile.content);
      const btn = document.querySelector('.file-panel-btn');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<span style="color:#22c55e">已复制!</span>`;
      setTimeout(() => btn.innerHTML = originalHtml, 1500);
    }
  }
}

const filePanel = new FilePanel();

// Tree node state management
const treeState = new Map();

// Load and render file tree
async function loadFileTree() {
  try {
    const result = await invoke('run_command', { args: ['--json', 'ls'] });
    if (result.ok && result.data?.entries) {
      const entries = result.data.entries;

      // 如果只有 workspace 一个目录，默认展开它
      if (entries.length === 1 && entries[0].name === 'workspace' && entries[0].type === 'dir') {
        const wsResult = await invoke('run_command', { args: ['--json', 'ls', 'workspace'] });
        if (wsResult.ok && wsResult.data?.entries) {
          const wsEntries = wsResult.data.entries;
          // 在 workspace 后面添加一个 wiki 条目（显示为根级）
          entries = [
            ...wsEntries,
            { name: 'wiki', type: 'dir', path: 'workspace/wiki' }
          ];

          // 预加载 workspace 子目录内容（只加载第一层）
          for (const entry of wsEntries) {
            if (entry.type === 'dir') {
              const subResult = await invoke('run_command', { args: ['--json', 'ls', `workspace/${entry.name}`] });
              if (subResult.ok && subResult.data?.entries) {
                const nodeId = `tree-${btoa(entry.name).replace(/[/+=]/g, '_')}`;
                treeState.set(nodeId, subResult.data.entries);
              }
            }
          }

          // 预加载 wiki 内容
          loadWikiContent();

          renderFileTree(entries, 'file-tree-root', 0, true);
          return;
        }
      }

      renderFileTree(entries, 'file-tree-root', 0, true);
    }
  } catch (e) {
    console.error('Failed to load file tree:', e);
  }
}

async function loadWikiContent() {
  try {
    const result = await invoke('run_command', { args: ['--json', 'ls', 'workspace/wiki'] });
    if (result.ok && result.data?.entries) {
      treeState.set('tree-wiki', result.data.entries);
    }
  } catch (e) {
    console.error('Failed to load wiki:', e);
  }
}

function renderFileTree(entries, containerId, depth = 0, autoExpand = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = entries.map(entry => {
    const isDir = entry.type === 'dir';
    const id = `tree-${btoa(entry.name).replace(/[/+=]/g, '_')}`;
    const paddingLeft = 12 + depth * 16;

    if (isDir) {
      const shouldAutoExpand = autoExpand && depth === 0;
      return `
        <div class="tree-node" data-name="${entry.name}" data-type="dir" data-id="${id}">
          <div class="tree-item ${shouldAutoExpand ? 'expanded' : ''}" style="padding-left:${paddingLeft}px" onclick="toggleTreeNode('${id}', '${entry.name}', '${entry.path || entry.name}')">
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
          <div class="tree-item" style="padding-left:${paddingLeft}px" onclick="openFilePreview('${entry.name}', '${entry.path || ''}')">
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
        const id = `tree-${btoa(entry.name).replace(/[/+=]/g, '_')}`;
        loadChildren(id, entry.path || entry.name);
      }
    }
  }
}

async function loadChildren(nodeId, dirPath) {
  try {
    const result = await invoke('run_command', { args: ['--json', 'ls', dirPath] });
    if (result.ok && result.data?.entries) {
      treeState.set(nodeId, result.data.entries);
      // 如果目录是展开的，渲染子内容
      const childrenEl = document.getElementById(`${nodeId}-children`);
      if (childrenEl && !childrenEl.classList.contains('hidden')) {
        renderFileTree(result.data.entries, `${nodeId}-children`, getTreeDepth(nodeId) + 1);
      }
    }
  } catch (e) {
    console.error('Failed to load directory:', e);
  }
}

async function toggleTreeNode(nodeId, dirName, dirPath) {
  const childrenEl = document.getElementById(`${nodeId}-children`);
  const chevronEl = document.getElementById(`${nodeId}-chevron`);
  const nodeEl = document.querySelector(`[data-id="${nodeId}"]`);
  const iconEl = nodeEl?.querySelector('.tree-icon');
  const itemEl = nodeEl?.querySelector('.tree-item');

  const path = dirPath || dirName;

  if (childrenEl.classList.contains('hidden')) {
    // Expand
    if (!treeState.has(nodeId)) {
      await loadChildren(nodeId, path);
    }

    const children = treeState.get(nodeId) || [];
    renderFileTree(children, `${nodeId}-children`, getTreeDepth(nodeId) + 1);
    childrenEl.classList.remove('hidden');
    chevronEl.classList.remove('collapsed');
    chevronEl.classList.add('expanded');
    chevronEl.innerHTML = icons.chevronDown;
    if (iconEl) iconEl.innerHTML = icons.folderOpen;
    if (itemEl) itemEl.classList.add('expanded');
  } else {
    // Collapse
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

async function openFilePreview(filename, filePath) {
  try {
    // 如果有路径，使用完整路径；否则只用文件名
    const readPath = filePath ? `${filePath}/${filename}` : filename;
    const result = await invoke('run_command', { args: ['--json', 'read', readPath] });
    if (result.ok) {
      filePanel.open({
        name: filename,
        content: result.data?.content || result.stdout,
        size: result.data?.size_bytes
      });
    } else {
      console.error('Failed to read file:', result.stderr);
    }
  } catch (e) {
    console.error('Failed to open file:', e);
  }
}

function openInExplorer() {
  invoke('get_workspace_path').then(path => {
    const fileUrl = 'file:///' + path.replace(/\\/g, '/');
    invoke('open_url', { url: fileUrl });
  });
}

function refreshTree() {
  treeState.clear();
  loadFileTree();
}