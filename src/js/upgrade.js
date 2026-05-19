// ── Upgrade Check ───────────────────────────────────────────
// Design: Distinctive, calm, utilitarian — avoids AI-slop patterns
let _upgradeInfo = null;

async function handleWindcliVersionClick() {
  if (!_upgradeInfo) {
    _upgradeInfo = await invoke('check_upgrade', {}, 5000).catch(() => null);
  }
  if (!_upgradeInfo || _upgradeInfo.found !== 'true') return;

  const hasUpdate = _upgradeInfo.has_update === 'true';

  if (hasUpdate) {
    showUpgradeDialog();
  } else {
    showToast('已是最新版本: ' + (_upgradeInfo.current_version || '未知'), 'success');
  }
}

// Clean, focused dialog — no gradients, no decorative elements
function showUpgradeDialog() {
  const overlay = document.createElement('div');
  overlay.id = 'upgradeOverlay';
  overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center z-[1000]';
  overlay.onclick = (e) => { if (e.target === overlay) closeUpgradeDialog(); };

  const dialog = document.createElement('div');
  dialog.className = 'bg-white rounded-xl shadow-xl w-[360px] overflow-hidden';

  // Header — utilitarian, purposeful
  const header = document.createElement('div');
  header.className = 'px-5 py-4 border-b border-slate-200';
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
        <span class="text-base">↻</span>
      </div>
      <div class="flex-1">
        <h3 class="text-base font-semibold text-slate-900">wind-cli 更新</h3>
        <p class="text-xs text-slate-500 mt-0.5">发现新版本可用</p>
      </div>
    </div>
  `;

  // Version comparison — clean, scannable
  const content = document.createElement('div');
  content.className = 'px-5 py-4';
  content.innerHTML = `
    <div class="flex items-center gap-4 py-2">
      <div class="flex-1 text-center">
        <div class="text-[11px] text-slate-500 mb-1 uppercase tracking-wide">当前</div>
        <div class="text-lg font-mono text-slate-700">${_upgradeInfo.current_version || '?'}</div>
      </div>
      <div class="text-slate-300 text-lg">→</div>
      <div class="flex-1 text-center">
        <div class="text-[11px] text-slate-500 mb-1 uppercase tracking-wide">最新</div>
        <div class="text-lg font-mono font-semibold text-slate-900">${_upgradeInfo.latest_version || '?'}</div>
      </div>
    </div>
  `;

  // Action area — minimal, no marketing fluff
  const actions = document.createElement('div');
  actions.className = 'px-5 pb-5 flex gap-2';
  actions.innerHTML = `
    <button onclick="closeUpgradeDialog()" class="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">稍后</button>
    <button onclick="doUpgrade()" class="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">下载更新</button>
  `;

  dialog.appendChild(header);
  dialog.appendChild(content);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function closeUpgradeDialog() {
  const overlay = document.getElementById('upgradeOverlay');
  if (overlay) overlay.remove();
}

async function doUpgrade() {
  closeUpgradeDialog();

  // Progress indicator — functional, not decorative
  const toast = document.createElement('div');
  toast.id = 'upgradeProgress';
  toast.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-8 flex flex-col items-center gap-4 z-[1001]';
  toast.innerHTML = `
    <div class="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
    <div class="text-center">
      <div class="text-sm font-medium text-slate-900">正在更新</div>
      <div class="text-xs text-slate-500 mt-1">请稍候...</div>
    </div>
  `;
  document.body.appendChild(toast);

  try {
    const result = await invoke('do_upgrade', {}, 120000);
    toast.remove();

    if (result && result.ok) {
      showToast('wind-cli 已更新，请重启应用', 'success');
      const dot = document.getElementById('windcliUpdateDot');
      if (dot) dot.classList.add('hidden');
      _upgradeInfo = null;
    } else {
      const errMsg = result?.stderr || result?.message || '未知错误';
      showToast('更新失败: ' + errMsg, 'error');
    }
  } catch (e) {
    toast.remove();
    showToast('更新失败: ' + String(e), 'error');
  }
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-900 text-white'
  };

  const toast = document.createElement('div');
  toast.className = `toast-notification fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg text-sm shadow-lg z-[1002] ${colors[type] || colors.info}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}