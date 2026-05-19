// ── Upgrade Check ───────────────────────────────────────────
async function showUpgradeModal() {
  const badge = document.getElementById('upgradeBadge');
  if (badge) badge.classList.add('hidden');

  const existingModal = document.getElementById('upgradeModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'upgradeModal';
  modal.className = 'fixed inset-0 z-[1001] bg-black/50 flex items-center justify-center';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-sm w-[90%] shadow-2xl">
      <h3 class="text-lg font-bold text-ink mb-4">版本更新</h3>
      <div id="upgradeContent" class="text-sm text-muted mb-4">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
          正在检查 wind-cli 版本...
        </div>
      </div>
      <div class="flex gap-2">
        <button onclick="this.closest('#upgradeModal').remove()" class="flex-1 px-4 py-2 border border-border rounded-xl text-sm text-muted hover:bg-slate-50">关闭</button>
        <button id="upgradeDoBtn" onclick="doUpgrade()" class="hidden flex-1 px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-blue-700">下载更新</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const info = await invoke('check_upgrade', {}, 10000);
    const content = document.getElementById('upgradeContent');
    const doBtn = document.getElementById('upgradeDoBtn');

    if (!info || info.found === 'false') {
      content.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-xl p-4">
          <div class="flex items-center gap-2 text-red-700 font-medium mb-1">
            <span class="text-lg">✗</span> wind-cli 未安装
          </div>
          <div class="text-sm text-red-600">
            ${info?.reason || '请先安装 wind-cli'}
          </div>
          <button onclick="showInstallModal()" class="mt-3 px-3 py-1.5 bg-brand text-white text-xs rounded-lg hover:bg-blue-700">
            前往安装
          </button>
        </div>`;
      return;
    }

    if (info.has_update === 'true') {
      content.innerHTML = `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
          <div class="flex items-center gap-2 text-amber-700 font-medium mb-1">
            <span class="text-lg">⚠️</span> 发现新版本
          </div>
          <div class="text-sm text-amber-600">
            当前版本: ${info.current_version || envState.windcliVersion || '未知'}<br>
            最新版本: ${info.latest_version || '未知'}
          </div>
        </div>
        <p class="text-xs text-faint mb-3">点击下方按钮下载并安装最新版本</p>
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-600">
          ${info.output || ''}
        </div>`;
      doBtn.classList.remove('hidden');
      doBtn.dataset.hasUpdate = 'true';
    } else {
      content.innerHTML = `
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div class="flex items-center gap-2 text-emerald-700 font-medium mb-1">
            <span class="text-lg">✓</span> 已是最新版本
          </div>
          <div class="text-sm text-emerald-600">
            当前版本: ${info.current_version || envState.windcliVersion || '未知'}
          </div>
        </div>`;
    }
  } catch (e) {
    const content = document.getElementById('upgradeContent');
    content.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-4">
        <div class="flex items-center gap-2 text-red-700 font-medium mb-1">
          <span class="text-lg">✗</span> 检查失败
        </div>
        <div class="text-sm text-red-600">${escHtml(String(e))}</div>
      </div>`;
  }
}

async function doUpgrade() {
  const content = document.getElementById('upgradeContent');
  const doBtn = document.getElementById('upgradeDoBtn');
  doBtn.disabled = true;
  doBtn.textContent = '更新中...';

  try {
    content.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
        正在更新 wind-cli...
      </div>`;

    const result = await invoke('do_upgrade', {}, 30000);
    if (result && result.ok) {
      content.innerHTML = `
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div class="flex items-center gap-2 text-emerald-700 font-medium mb-2">
            <span class="text-lg">✓</span> 更新成功
          </div>
          <p class="text-sm text-emerald-600">wind-cli 已更新，请重启应用</p>
        </div>`;
    } else {
      content.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-xl p-4">
          <div class="flex items-center gap-2 text-red-700 font-medium mb-2">
            <span class="text-lg">✗</span> 更新失败
          </div>
          <p class="text-xs text-red-600 mb-2">${escHtml(result?.stderr || '未知错误')}</p>
          <a href="https://github.com/wbyanclaw/wind-cli/releases/latest" target="_blank" class="text-xs text-brand hover:underline">手动下载最新版本 →</a>
        </div>`;
    }
  } catch (e) {
    content.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-4">
        <div class="flex items-center gap-2 text-red-700 font-medium mb-2">
          <span class="text-lg">✗</span> 更新失败
        </div>
        <p class="text-xs text-red-600">${escHtml(String(e))}</p>
      </div>`;
  }

  if (doBtn) doBtn.remove();
}