// ── Detail Panel ─────────────────────────────────────────
let currentMode = 'details';

function switchMode(mode, btn) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.remove('active', 'bg-white', 'text-brand', 'shadow-sm');
    t.classList.add('text-muted');
  });
  btn.classList.add('active', 'bg-white', 'text-brand', 'shadow-sm');
  btn.classList.remove('text-muted');
  document.getElementById('details-panel').classList.toggle('hidden', mode !== 'details');
}

function switchTab(name, btn) {
  document.querySelectorAll('.detail-content').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.detail-tab').forEach(t => {
    t.classList.remove('active');
    t.classList.add('text-muted');
  });
  const panel = document.getElementById('detail-' + name);
  if (panel) panel.classList.remove('hidden');
  if (btn) {
    btn.classList.add('active', 'text-brand', 'bg-white');
    btn.classList.remove('text-muted');
    btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  }
  // Save tab preference
  appState.rightPanelTab = name;
  try {
    invoke('winwork_save_state', {
      relativePath: `workspaces/${appState.activeWorkspace}/settings.json`,
      data: { rightPanelTab: name }
    });
  } catch (e) {}
}

function toggleDetail() {
  const panel = document.getElementById('rightPanel');
  const btn = document.getElementById('detailBtn');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    btn.innerHTML = '<span class="w-3.5 h-3.5">✕</span></span>收起调试';
    btn.style.color = 'var(--brand)';
    btn.style.borderColor = 'var(--brand)';
  } else {
    btn.innerHTML = '<span class="w-3.5 h-3.5">▶</span></span>查看调试';
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}