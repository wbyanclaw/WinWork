// Window Controls Component
class WindowControls {
  async minimize() {
    try {
      const win = await window.__TAURI__.window.getCurrentWindow();
      await win.minimize();
    } catch (e) {
      console.error('Minimize failed:', e);
    }
  }

  async maximize() {
    try {
      const win = await window.__TAURI__.window.getCurrentWindow();
      const isMaximized = await win.isMaximized();
      if (isMaximized) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    } catch (e) {
      console.error('Maximize failed:', e);
    }
  }

  async close() {
    try {
      const win = await window.__TAURI__.window.getCurrentWindow();
      await win.close();
    } catch (e) {
      console.error('Close failed:', e);
    }
  }
}

const windowControls = new WindowControls();
