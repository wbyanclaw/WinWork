// ── Chat Messages ──────────────────────────────────────────
function appendMessage(role, text, container) {
  const div = document.createElement('div');
  div.className = `msg ${role} animate-fade-up flex gap-2.5 max-w-2xl ${role === 'user' ? 'ml-auto' : ''}`;
  if (role === 'user') {
    div.innerHTML = `<div class="flex-1 flex flex-col items-end gap-1"><span class="text-[10px] text-faint px-1">你</span><div class="bg-brand text-white px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed shadow-sm">${escHtml(text)}</div></div><div class="w-7 h-7 rounded-full bg-brand flex items-center justify-center flex-shrink-0 mt-5"><span class="w-3.5 h-3.5 text-white">👤</span></span></div>`;
  } else {
    div.innerHTML = `<div class="w-7 h-7 rounded-full bg-slate-100 border border-border flex items-center justify-center flex-shrink-0 mt-5"><span class="w-3.5 h-3.5 text-brand">🤖</span></span></div><div class="flex-1 flex flex-col gap-1"><span class="text-[10px] text-faint px-1">winwork</span><div class="bg-white border border-border rounded-2xl rounded-tl-md px-3.5 py-3 text-sm leading-relaxed shadow-sm">${escHtml(text)}</div></div>`;
  }
  container.appendChild(div);
}

function appendAgentThinking(aid, container) {
  const div = document.createElement('div');
  div.id = aid;
  div.className = 'msg agent animate-fade-up flex gap-2.5 max-w-2xl';
  div.innerHTML = `<div class="w-7 h-7 rounded-full bg-slate-100 border border-border flex items-center justify-center flex-shrink-0 mt-5"><span class="w-3.5 h-3.5 text-brand">🤖</span></span></div><div class="flex-1 flex flex-col gap-1"><span class="text-[10px] text-faint px-1">winwork</span><div class="bg-white border border-border rounded-2xl rounded-tl-md px-3.5 py-3 text-sm leading-relaxed shadow-sm" id="${aid}-bubble"><div class="flex items-center gap-1.5 text-[11px] text-faint mt-1.5"><div class="thinking-dots"><span></span><span></span><span></span></div>正在调用 wind-cli 工具...</div></div></div>`;
  container.appendChild(div);
}

// ── Send / Cancel ─────────────────────────────────────────
let _pendingAid = null;
let _pendingText = '';

async function send() {
  const inp = document.getElementById('input');
  const text = inp.value.trim();
  if (!text) return;

  const cancelBtn = document.getElementById('cancelBtn');
  const sendBtn = document.getElementById('sendBtn');
  if (cancelBtn) cancelBtn.classList.remove('hidden');
  if (sendBtn) sendBtn.disabled = true;

  _pendingText = text;
  inp.value = '';
  resize(inp);

  const msgs = document.getElementById('messages');
  document.getElementById('welcomeScreen')?.remove();
  appendMessage('user', text, msgs);
  const aid = 'm' + Date.now();
  _pendingAid = aid;
  appendAgentThinking(aid, msgs);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    let result, responseText;

    if (apiKey) {
      const aiResult = await invoke('ai_chat', { message: text, apiKey: apiKey, baseUrl: apiBaseUrl, model: apiModel });
      result = aiResult;
      responseText = aiResult.response;

      setTimeout(() => {
        const bubble = document.getElementById(aid + '-bubble');
        if (!bubble) return;

        let commandsHtml = '';
        if (aiResult.commands_executed && aiResult.commands_executed.length > 0) {
          commandsHtml = '<div class="mt-3 space-y-2">';
          aiResult.commands_executed.forEach((cmd, i) => {
            const cmdResult = aiResult.command_results[i];
            commandsHtml += `<div class="bg-slate-50 border border-border rounded-lg px-3 py-2"><div class="font-mono text-[11px] text-brand mb-1">$ wind ${escHtml(cmd)}</div>${cmdResult.ok ? '<span class="text-[10px] text-emerald-600">✓ 成功</span>' : '<span class="text-[10px] text-red-500">✗ 失败</span>'}</div>`;
          });
          commandsHtml += '</div>';
        }

        bubble.innerHTML = `<p class="mb-2">${escHtml(text)}</p><div class="text-sm leading-relaxed whitespace-pre-wrap">${_sanitizeAiResponse(responseText)}</div>${commandsHtml}`;
        msgs.scrollTop = msgs.scrollHeight;
      }, 500);
    } else {
      const key = routeCommand(text);
      if (key === 'mkdir') {
        const tokens = text.split(/\s+/).filter(t => t && !/^[^\s一-鿿]+$/.test(t) || t.length > 1);
        const path = tokens[tokens.length - 1] || 'newdir';
        result = await invoke('mkdir_dir', { path });
        displayWindResult(aid, text, result, 'mkdir');
      } else if (key === 'wiki_query') {
        const question = text.replace(/知识库|wiki|查/gi, '').trim() || '介绍一下你自己';
        result = await invoke('wiki_query', { question });
        displayWindResult(aid, text, result, 'wiki query');
      } else if (key === 'wft') {
        const tokens = text.split(/\s+/).filter(t => t && !/^[^\s一-鿿]+$/.test(t) || t.length > 1);
        const file = tokens[tokens.length - 1] || 'test.txt';
        result = await invoke('wft_open', { file });
        displayWindResult(aid, text, result, 'wft');
      } else {
        const args = buildArgs(key, text);
        result = await invoke('run_wind_command', { args });
        displayWindResult(aid, text, result, args[0]);
      }
    }
    lastResult = result;
  } catch (e) {
    const bubble = document.getElementById(aid + '-bubble');
    if (bubble) {
      bubble.innerHTML = `<p>⚠️ 无法执行命令: ${escHtml(String(e))}</p>`;
    }
  } finally {
    _pendingAid = null;
    const cancelBtn = document.getElementById('cancelBtn');
    const sendBtn = document.getElementById('sendBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (sendBtn) sendBtn.disabled = false;
  }
}

function cancelSend() {
  const cancelBtn = document.getElementById('cancelBtn');
  const sendBtn = document.getElementById('sendBtn');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  if (sendBtn) sendBtn.disabled = false;

  if (_pendingAid) {
    const thinkingMsg = document.getElementById(_pendingAid);
    if (thinkingMsg) thinkingMsg.remove();

    const messages = document.getElementById('messages');
    const userMsgs = messages.querySelectorAll('.msg.user');
    if (userMsgs.length > 0) {
      userMsgs[userMsgs.length - 1].remove();
    }

    const inp = document.getElementById('input');
    if (inp && _pendingText) {
      inp.value = _pendingText;
      resize(inp);
      inp.focus();
    }
  }
  _pendingAid = null;
  _pendingText = '';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

// ── Command Router ─────────────────────────────────────────
function routeCommand(text) {
  const t = text.toLowerCase();
  if (t.includes('列出') || t.includes('list') || t.includes('ls') || t.includes('文件')) return 'ls';
  if (t.includes('创建') || t.includes('mkdir') || t.includes('目录') || t.includes('新建')) return 'mkdir';
  if (t.includes('写') || t.includes('put') || t.includes('创建文件')) return 'write';
  if (t.includes('wft') || t.includes('打开') || t.includes('open')) return 'wft';
  if (t.includes('知识库') || t.includes('wiki') || t.includes('查')) return 'wiki_query';
  return 'ls';
}

function buildArgs(key, text) {
  switch (key) {
    case 'ls': return ['ls'];
    case 'write': return ['write', 'test.txt', '--stdin'];
    case 'wiki_query': return ['wiki', 'query'];
    default: return ['ls'];
  }
}

// ── Scenario Chips ─────────────────────────────────────────
function runScenario(key) {
  const scenarios = {
    ls: '列出工作区中的所有文件',
    mkdir: '创建一个新目录',
    write: '写入一个测试文件',
    wft: '打开工作区文件'
  };
  const inp = document.getElementById('input');
  inp.value = scenarios[key] || '列出文件';
  send();
}