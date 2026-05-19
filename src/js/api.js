// ── Tauri API ─────────────────────────────────────────────
async function invoke(cmd, args = {}, timeoutMs = 10000) {
  if (typeof window.__TAURI__ !== 'undefined') {
    const { invoke: tauriInvoke } = window.__TAURI__.core;
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ _timeout: true, cmd, timeoutMs }), timeoutMs)
    );
    try {
      const result = await Promise.race([tauriInvoke(cmd, args), timeoutPromise]);
      if (result === null || result === undefined) {
        window._log && window._log(`invoke ${cmd} returned null`);
        return { ok: false, stderr: `invoke null: ${cmd}`, stdout: '', exit_code: -1, data: null };
      }
      if (result._timeout) {
        window._log && window._log(`invoke ${cmd} timed out after ${timeoutMs}ms`);
        return { ok: false, stderr: `invoke timeout: ${cmd} (>${timeoutMs}ms)`, stdout: '', exit_code: -1, data: null };
      }
      return result;
    } catch (e) {
      const errMsg = e && typeof e === 'object' ? (e.message || String(e)) : String(e || 'unknown error');
      window._log && window._log(`invoke ${cmd} failed:`, errMsg);
      return { ok: false, stderr: errMsg, stdout: '', exit_code: -1, data: null };
    }
  } else {
    return { ok: true, data: { entries: [] }, stderr: '' };
  }
}

// ── Environment ──────────────────────────────────────────
let envState = { windcli: false, windcliPath: '', windcliVersion: '', winworkVersion: '0.2.22' };

async function checkAllEnv() {
  const statusBar = document.getElementById('envStatusBar');
  const modal = document.getElementById('installModal');

  try {
    const wwVer = await invoke('get_winwork_version');
    envState.winworkVersion = wwVer;
    const verEl = document.getElementById('winworkVersion');
    if (verEl) verEl.textContent = wwVer;
  } catch (e) { window._log && window._log('get_winwork_version failed:', e); }

  try {
    const info = await invoke('check_windcli');
    envState.windcli = info.found === 'true';
    envState.windcliPath = info.path || '';
    envState.windcliVersion = info.version || '';
    window._log && window._log('windcli info:', JSON.stringify(info));
    const wcVerEl = document.getElementById('windcliVersion');
    if (wcVerEl) wcVerEl.textContent = info.version || '?';
  } catch (e) { envState.windcli = false; }

  const allReady = envState.windcli;
  const diagInfo = `winwork ${envState.winworkVersion} | windcli ${envState.windcliVersion} @ ${envState.windcliPath}`;

  if (allReady) {
    statusBar.innerHTML = `<span class="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[11px] px-2 py-0.5 rounded-full font-medium"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot"></span>就绪 <span class="text-faint ml-1">${diagInfo}</span></span>`;
    modal.classList.add('hidden');
  } else {
    statusBar.innerHTML = `<span class="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-[11px] px-2 py-0.5 rounded-full font-medium"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>wind-cli 未安装，点击安装 <span class="text-faint ml-1">${diagInfo}</span></span>`;
    modal.classList.add('hidden');
    statusBar.style.cursor = 'pointer';
    statusBar.onclick = showInstallModal;
  }
  return allReady;
}

async function doCheckEnv() {
  const info = await invoke('check_windcli');
  const ww = await invoke('get_winwork_version');
  let cliPath = info.found === 'true' ? (info.path?.includes('/') || info.path?.includes('\\') ? info.path : 'PATH') : '未安装';
  let msg = `winwork: ${ww}\nwind-cli: ${info.found === 'true' ? '已安装 (来自 ' + cliPath + ') v' + (info.version || '?').replace(/^wind\s*/i, '') : '未安装'}`;
  appendMessage('agent', msg, document.getElementById('messages'));
}