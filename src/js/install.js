// ── Install Modal ──────────────────────────────────────────
function updateModalUI() {
  const btn = document.getElementById('modal-main-btn');
  const btnText = document.getElementById('modal-btn-text');
  const btnIcon = document.getElementById('modal-btn-icon');
  if (!btn) return;

  if (btnIcon) {
    if (window._lucideReady && window.lucide) {
      btnIcon.textContent = '';
      btnIcon.setAttribute('data-lucide', envState.windcli ? 'arrow-right' : 'zap');
    } else {
      btnIcon.textContent = envState.windcli ? '→' : '⚡';
    }
  }

  if (!envState.windcli) {
    btn.className = 'w-full bg-brand text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2';
    if (btnText) btnText.textContent = '⚡ 一键安装 wind-cli';
  } else {
    btn.className = 'w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2';
    if (btnText) btnText.textContent = '开始使用 winwork';
  }
}

function showInstallModal() {
  const modal = document.getElementById('installModal');
  if (modal) {
    updateModalUI();
    modal.classList.remove('hidden');
  }
}

async function handleModalButton() {
  const btn = document.getElementById('modal-main-btn');
  const btnText = document.getElementById('modal-btn-text');

  if (!envState.windcli) {
    btn.disabled = true;
    btnText.textContent = '正在打开下载页...';
    try {
      const result = await invoke('trigger_install');
      if (result.ok) {
        btnText.textContent = '已在浏览器打开，请下载 wind-cli 安装后重启本应用';
        btn.disabled = true;
        await pollForInstall();
      } else {
        btnText.textContent = '安装失败，请手动下载';
        btn.disabled = false;
      }
    } catch (e) {
      btnText.textContent = '安装失败，请手动下载';
      btn.disabled = false;
    }
  } else {
    enterMainUI();
  }
}

async function pollForInstall() {
  const btnText = document.getElementById('modal-btn-text');
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const info = await invoke('check_windcli');
      envState.windcli = info.found === 'true';
    } catch (e) { envState.windcli = false; }
    if (envState.windcli) {
      updateModalUI();
      enterMainUI();
      return;
    }
  }
  if (btnText) btnText.textContent = '安装超时，请在浏览器下载 wind-cli 后点击上方按钮重试';
  const btn = document.getElementById('modal-main-btn');
  if (btn) {
    btn.disabled = false;
    btn.onclick = handleModalButton;
  }
}

function skipAndContinue() {
  enterMainUI();
}

function enterMainUI() {
  document.getElementById('installModal').classList.add('hidden');
}

// ESC to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('installModal').classList.add('hidden');
  }
});