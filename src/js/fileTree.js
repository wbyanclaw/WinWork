// ── File Tree ──────────────────────────────────────────────
async function loadFileTree() {
  const container = document.getElementById('fileTree');
  if (!container) return;

  container.innerHTML = '<div class="px-4 py-2 text-xs text-faint">加载中...</div>';
  const loadTimeout = setTimeout(() => {
    const existing = container.querySelector('.text-faint');
    if (existing && existing.textContent === '加载中...') {
      existing.parentElement.innerHTML = '<div class="px-4 py-2 text-xs text-red-500">⚠ 加载超时</div><div class="px-4 py-1 text-xs text-faint">wind-cli 可能未安装或无响应</div>';
    }
  }, 5000);

  try {
    const wsResult = await Promise.race([
      invoke('list_workspace'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    const wikiResult = await Promise.race([
      invoke('list_wiki'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    clearTimeout(loadTimeout);
    container.innerHTML = '';

    // Section: 文件 (workspace)
    const wsSection = document.createElement('div');
    wsSection.className = 'mb-3';
    wsSection.innerHTML = '<div class="px-3 pb-1"><span class="text-[10px] font-semibold text-faint uppercase tracking-wide px-2 py-1 block">文件</span></div>';

    const wsFolder = document.createElement('div');
    wsFolder.className = 'tree-item flex items-center gap-2 px-4 py-1.5 cursor-pointer text-sm text-ink font-medium';
    wsFolder.innerHTML = `<span class="w-4 h-4 flex items-center justify-center">📁</span><span>workspace/</span>`;
    wsSection.appendChild(wsFolder);

    if (wsResult.ok && wsResult.data && wsResult.data.entries && wsResult.data.entries.length > 0) {
      const entries = wsResult.data.entries;
      entries.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'tree-item flex items-center gap-2 px-4 py-1.5 cursor-pointer text-sm text-slate-500 hover:bg-slate-50';
        div.innerHTML = `<span class="w-4 h-4 flex items-center justify-center text-xs">${entry.is_dir ? '📁' : '📄'}</span><span class="truncate flex-1">${escHtml(entry.name)}</span>`;
        if (!entry.is_dir) {
          div.onclick = () => showFileContent(entry.name);
        }
        wsSection.appendChild(div);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'px-4 py-1 text-xs text-faint';
      empty.textContent = '(空)';
      wsSection.appendChild(empty);
    }

    container.appendChild(wsSection);

    const divider = document.createElement('div');
    divider.className = 'mx-4 my-2 border-t border-border';
    container.appendChild(divider);

    const wikiSection = document.createElement('div');
    wikiSection.innerHTML = '<div class="px-3 pb-1"><span class="text-[10px] font-semibold text-faint uppercase tracking-wide px-2 py-1 block">知识库</span></div>';

    const wikiFolder = document.createElement('div');
    wikiFolder.className = 'tree-item flex items-center gap-2 px-4 py-1.5 cursor-pointer text-sm text-ink font-medium';
    wikiFolder.innerHTML = `<span class="w-4 h-4 flex items-center justify-center">📖</span><span>wiki/</span>`;
    wikiSection.appendChild(wikiFolder);

    if (wikiResult.ok && wikiResult.data) {
      const fileCount = wikiResult.data.file_count || 0;
      const empty = document.createElement('div');
      empty.className = 'px-4 py-1 text-xs text-faint';
      empty.textContent = fileCount > 0 ? `${fileCount} 个文档` : '(空)';
      wikiSection.appendChild(empty);
    } else {
      const empty = document.createElement('div');
      empty.className = 'px-4 py-1 text-xs text-faint';
      empty.textContent = '(空)';
      wikiSection.appendChild(empty);
    }

    container.appendChild(wikiSection);
  } catch (e) {
    clearTimeout(loadTimeout);
    const errMsg = String(e);
    let errorHtml;
    if (errMsg.includes('PATH_TRAVERSAL') || errMsg.includes('path traversal')) {
      errorHtml = `<div class="px-4 py-2 text-xs text-red-600">路径穿越错误</div><div class="px-4 py-1 text-xs text-faint mb-2">wind-cli 检测到非法路径访问</div>`;
    } else if (errMsg.includes('not found') || errMsg.includes('not installed')) {
      errorHtml = `<div class="px-4 py-2 text-xs text-amber-600">⚠ wind-cli 未安装</div><div class="px-4 py-1 text-xs text-faint mb-2">请先安装 wind-cli</div><button onclick="showInstallModal()" class="mx-4 mb-2 px-3 py-1.5 bg-brand text-white text-xs rounded-lg hover:bg-blue-700">安装 wind-cli</button>`;
    } else {
      errorHtml = `<div class="px-4 py-2 text-xs text-amber-600">⚠ wind-cli 执行出错</div><div class="px-4 py-1 text-xs text-faint mb-2">${escHtml(errMsg.slice(0, 100))}</div>`;
    }
    errorHtml += `<button onclick="loadFileTree()" class="mx-4 mb-2 px-3 py-1.5 border border-border text-xs rounded-lg hover:bg-slate-50">🔄 重新加载</button><button onclick="doCheckEnv()" class="mx-4 mb-2 px-3 py-1.5 border border-border text-xs rounded-lg hover:bg-slate-50">🔍 检查环境</button>`;
    container.innerHTML = errorHtml;
    window._log && window._log('loadFileTree failed:', e);
  }
}

async function showFileContent(filename) {
  const result = await invoke('read_file', { path: filename });
  if (result.ok && result.data && result.data.content) {
    const file = document.getElementById('detail-file');
    if (file) {
      file.innerHTML = `<div class="bg-slate-50 border border-border rounded-xl p-4 font-mono text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">${escHtml(result.data.content)}</div>`;
    }
    switchTab('file', document.getElementById('tab-file'));
  }
}

async function doReloadWorkspace() {
  await loadFileTree();
}