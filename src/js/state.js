// ── State Persistence ──────────────────────────────────────
let appState = {
  activeWorkspace: 'default',
  workspaces: [],
  rightPanelTab: 'trace'
};
let lastResult = null;

async function loadAppState() {
  try {
    const state = await invoke('load_state', { relativePath: 'state.json' });
    if (state && state !== null && typeof state === 'object') {
      appState.activeWorkspace = state.activeWorkspace || 'default';
      appState.rightPanelTab = state.rightPanelTab || 'trace';
    }
  } catch (e) {
    appState.activeWorkspace = 'default';
  }

  try {
    await invoke('ensure_workspace_dir', { name: appState.activeWorkspace });
  } catch (e) {}

  await loadWorkspaceState();

  const tabId = 'tab-' + appState.rightPanelTab;
  const tabBtn = document.getElementById(tabId);
  if (tabBtn) switchTab(appState.rightPanelTab, tabBtn);
}

async function loadWorkspaceState() {
  const ws = appState.activeWorkspace;
  try {
    const chat = await invoke('load_state', { relativePath: `workspaces/${ws}/chat.json` });
    if (chat && chat !== null && Array.isArray(chat.messages)) {
      restoreChatHistory(chat.messages);
    }
  } catch (e) {}

  try {
    const tree = await invoke('load_state', { relativePath: `workspaces/${ws}/tree_state.json` });
    if (tree && tree !== null) {
      window._treeState = tree.expanded || [];
    }
  } catch (e) {}
}

function restoreChatHistory(messages) {
  const container = document.getElementById('messages');
  if (!container) return;
  document.getElementById('welcomeScreen')?.remove();
  messages.forEach(msg => {
    if (msg.role === 'user') {
      appendMessage('user', msg.text, container);
    } else {
      appendMessage('agent', msg.text, container);
    }
  });
}

async function saveChatHistory() {
  const container = document.getElementById('messages');
  if (!container) return;
  const bubbles = container.querySelectorAll('.msg');
  const messages = [];
  bubbles.forEach(bubble => {
    if (bubble.classList.contains('user')) {
      const text = bubble.querySelector('.bg-brand')?.textContent?.trim() || '';
      if (text) messages.push({ role: 'user', text });
    } else if (bubble.classList.contains('agent') || (bubble.querySelector('.bg-white') && !bubble.classList.contains('user'))) {
      const text = bubble.querySelector('.bg-white')?.textContent?.trim() ||
        bubble.querySelector('[id$="-bubble"]')?.textContent?.trim() || '';
      if (text) messages.push({ role: 'agent', text });
    }
  });
  try {
    await invoke('save_state', {
      relativePath: `workspaces/${appState.activeWorkspace}/chat.json`,
      data: { messages }
    });
  } catch (e) {}
}

async function saveGlobalState() {
  try {
    await invoke('save_state', {
      relativePath: 'state.json',
      data: {
        activeWorkspace: appState.activeWorkspace,
        rightPanelTab: appState.rightPanelTab
      }
    });
  } catch (e) {}
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  window._log('INIT: starting');
  updateStatusBar('loading', '正在启动...');

  loadApiConfig();
  updateApiKeyStatus();

  try {
    updateStatusBar('loading', '检查环境...');
    await Promise.race([
      checkAllEnv(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('env check timeout')), 8000))
    ]);
    window._log('INIT: env check done');
  } catch (e) {
    window._log && window._log('INIT: env check failed/timeout:', e.message);
    envState = { windcli: false };
  }

  // Check for wind-cli upgrades (async)
  setTimeout(async () => {
    try {
      const upgradeInfo = await invoke('check_upgrade', {}, 5000);
      window._log && window._log('upgrade check:', JSON.stringify(upgradeInfo));
      if (upgradeInfo && upgradeInfo.found === 'true') {
        const badge = document.getElementById('upgradeBadge');
        const btnText = document.getElementById('upgradeBtnText');
        if (badge && upgradeInfo.has_update === 'true') {
          badge.classList.remove('hidden');
          if (btnText) btnText.textContent = '版本更新 ⚠️';
        } else if (badge) {
          badge.classList.add('hidden');
        }
      }
    } catch (e) {
      window._log && window._log('upgrade check failed:', e);
    }
  }, 2000);

  try {
    updateStatusBar('loading', '加载状态...');
    await Promise.race([
      loadAppState(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('load state timeout')), 5000))
    ]);
    window._log('INIT: state loaded');
  } catch (e) {
    window._log && window._log('INIT: state load failed:', e.message);
  }

  try {
    updateStatusBar('loading', '初始化工作区...');
    await Promise.race([
      initWorkspace(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('init workspace timeout')), 10000))
    ]);
    window._log('INIT: workspace ready');
  } catch (e) {
    window._log && window._log('INIT: workspace init failed/timeout:', e.message);
  }

  try {
    updateStatusBar('loading', '加载文件...');
    await Promise.race([
      loadFileTree(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('load file tree timeout')), 5000))
    ]);
  } catch (e) {
    window._log && window._log('INIT: file tree load failed:', e.message);
  }

  enterMainUI();
  updateStatusBar('ready', '就绪');
  window._log('INIT: complete');
}

async function initWorkspace() {
  try {
    const result = await invoke('init_demo_workspace');
    if (result && !result.ok) {
      window._log && window._log('initWorkspace: wind init 失败', result.stderr);
    } else {
      window._log && window._log('initWorkspace: workspace 初始化成功');
    }
  } catch (e) {
    window._log && window._log('initWorkspace: 异常', e);
  }
}

function updateStatusBar(state, message) {
  const statusBar = document.getElementById('envStatusBar');
  if (!statusBar) return;
  let colorClass = 'text-faint';
  let bgClass = 'bg-slate-50';
  let borderClass = 'border-border';
  let dotColor = 'bg-slate-400';
  switch (state) {
    case 'loading': colorClass = 'text-amber-600'; bgClass = 'bg-amber-50'; borderClass = 'border-amber-200'; dotColor = 'bg-amber-400 pulse-dot'; break;
    case 'ready': colorClass = 'text-emerald-600'; bgClass = 'bg-emerald-50'; borderClass = 'border-emerald-200'; dotColor = 'bg-emerald-500'; break;
    case 'error': colorClass = 'text-red-600'; bgClass = 'bg-red-50'; borderClass = 'border-red-200'; dotColor = 'bg-red-500'; break;
  }
  statusBar.innerHTML = `
    <span class="flex items-center gap-1.5 ${bgClass} border ${borderClass} ${colorClass} text-[11px] px-2 py-0.5 rounded-full font-medium">
      <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
      ${escHtml(message)}
    </span>`;
}

// Patch appendMessage to auto-save chat after each message
const _origAppendMessage = appendMessage;
appendMessage = function (role, text, container) {
  _origAppendMessage(role, text, container);
  clearTimeout(window._chatSaveTimer);
  window._chatSaveTimer = setTimeout(() => saveChatHistory(), 2000);
};

// Patch switchTab to persist tab selection
const _origSwitchTab = switchTab;
switchTab = function (name, btn) {
  _origSwitchTab(name, btn);
  appState.rightPanelTab = name;
};