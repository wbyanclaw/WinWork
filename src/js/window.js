// ── Window Controls ───────────────────────────────────────
async function winMinimize() {
  try {
    const win = window.__TAURI__.window.getCurrentWindow();
    await win.minimize();
  } catch (e) { window._log && window._log('winMinimize failed:', e); }
}

async function winMaximize() {
  try {
    const win = window.__TAURI__.window.getCurrentWindow();
    const isMaximized = await win.isMaximized();
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  } catch (e) { window._log && window._log('winMaximize failed:', e); }
}

async function winClose() {
  try {
    const win = window.__TAURI__.window.getCurrentWindow();
    await win.close();
  } catch (e) { window._log && window._log('winClose failed:', e); }
}