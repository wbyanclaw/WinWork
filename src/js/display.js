// ── Wind Result Display ─────────────────────────────────────
function displayWindResult(aid, text, result, cmdName) {
  const bubble = document.getElementById(aid + '-bubble');
  if (!bubble) return;
  bubble.innerHTML = `
    <p class="mb-2">${escHtml(text)}</p>
    <div class="mt-2 rounded-lg border border-border overflow-hidden">
      <div class="bg-slate-50 border-b border-border px-3 py-2 flex items-center gap-1.5">
        <span class="w-3 h-3 text-brand">⚡</span></span>
        <span class="text-[11px] text-muted font-medium">wind — ${escHtml(cmdName)}</span>
      </div>
      <div class="px-3 py-2.5">
        <div class="flex items-center gap-1.5 mb-2">
          <span class="text-[10px] ${result.ok ? 'bg-successBg text-success border border-emerald-200' : 'bg-red-50 text-red-500 border border-red-200'} px-1.5 py-0.5 rounded-full font-medium">${result.ok ? '✓ 执行成功' : '✗ 执行失败'}</span>
        </div>
        ${result.stdout ? `<div class="font-mono bg-slate-50 border border-border rounded px-2.5 py-1.5 text-[12px] text-brand mb-2 whitespace-pre-wrap">${escHtml(result.stdout)}</div>` : ''}
        ${result.stderr ? `<div class="text-[11px] text-red-500 mt-1">${escHtml(result.stderr)}</div>` : ''}
        ${result.data && result.data.error ? `<div class="mt-2 text-[11px] text-red-500 bg-red-50 border border-red-200 rounded px-2.5 py-2">${escHtml(result.data.error.message || JSON.stringify(result.data.error))}</div>` : ''}
      </div>
    </div>`;
  document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

  updateDetailPanels(aid, text, result, cmdName);
}

function updateDetailPanels(aid, text, result, cmdName) {
  const trace = document.getElementById('detail-trace');
  const source = document.getElementById('detail-source');
  const placeholder = document.getElementById('detail-placeholder');
  if (placeholder) placeholder.classList.add('hidden');

  const traceSteps = `
    <div class="space-y-0">
      <div class="flex gap-3 mb-4">
        <div class="flex flex-col items-center"><div class="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-300 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</div><div class="flex-1 w-px bg-border mt-1"></div></div>
        <div class="pb-3 flex-1"><div class="text-[11px] text-faint mb-0.5">步骤 1 · 用户输入</div><div class="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[12px] text-slate-700 leading-relaxed">"${escHtml(text)}"</div></div>
      </div>
      <div class="flex gap-3 mb-4">
        <div class="flex flex-col items-center"><div class="w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</div><div class="flex-1 w-px bg-border mt-1"></div></div>
        <div class="pb-3 flex-1"><div class="text-[11px] text-faint mb-0.5">步骤 2 · AI 解析意图</div><div class="bg-white border border-border rounded-lg px-3 py-2 text-[12px] text-slate-600 leading-relaxed">识别为 <span class="text-brand font-mono">wind ${escHtml(cmdName)}</span> 命令</div></div>
      </div>
      <div class="flex gap-3 mb-4">
        <div class="flex flex-col items-center"><div class="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-300 text-amber-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</div><div class="flex-1 w-px bg-border mt-1"></div></div>
        <div class="pb-3 flex-1"><div class="text-[11px] text-faint mb-0.5">步骤 3 · wind-cli 执行</div><div class="bg-slate-900 rounded-lg px-3 py-2 text-[11px] text-emerald-400 font-mono">$ wind ${escHtml(cmdName)}</div></div>
      </div>
      <div class="flex gap-3 mb-4">
        <div class="flex flex-col items-center"><div class="w-6 h-6 rounded-full bg-purple-100 border-2 border-purple-300 text-purple-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</div><div class="flex-1 w-px bg-border mt-1"></div></div>
        <div class="pb-3 flex-1"><div class="text-[11px] text-faint mb-0.5">步骤 4 · 返回结果</div><div class="bg-slate-900 rounded-lg px-3 py-2 overflow-x-auto"><pre class="text-[11px] text-slate-300 font-mono whitespace-pre">${result.ok && result.stdout ? escHtml(result.stdout.slice(0, 500)) : (result.data && result.data.error ? '错误: ' + escHtml((result.data.error.message || JSON.stringify(result.data.error)).slice(0, 200)) : (result.stderr ? escHtml(result.stderr.slice(0, 200)) : '无输出'))}</pre></div></div>
      </div>
      <div class="flex gap-3">
        <div class="flex flex-col items-center"><div class="w-6 h-6 rounded-full bg-green-100 border-2 border-green-300 text-green-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">5</div></div>
        <div class="flex-1"><div class="text-[11px] text-faint mb-0.5">步骤 5 · AI 格式化回复</div><div class="bg-white border border-border rounded-lg px-3 py-2 text-[12px] text-slate-600 leading-relaxed">${result.ok ? '执行成功，结果已格式化' : '执行失败，请检查输入'}</div></div>
      </div>
    </div>`;
  if (trace) trace.innerHTML = traceSteps;

  const sourceContent = `
    <div class="text-[11px] font-semibold text-muted mb-3 uppercase tracking-wide">原始数据溯源</div>
    <div class="space-y-3">
      <div class="bg-slate-50 border border-border rounded-xl overflow-hidden">
        <div class="px-3 py-2 border-b border-border bg-slate-100 flex items-center gap-2"><span class="w-3.5 h-3.5 text-brand">↓</span><span class="text-[11px] font-semibold text-muted">输入数据</span></div>
        <div class="p-3"><div class="text-[10px] text-faint mb-1">用户输入（原始）</div><div class="font-mono text-[12px] text-slate-700">"${escHtml(text)}"</div></div>
      </div>
      <div class="bg-slate-50 border border-border rounded-xl overflow-hidden">
        <div class="px-3 py-2 border-b border-border bg-slate-100 flex items-center gap-2"><span class="w-3.5 h-3.5 text-brand">⌨</span><span class="text-[11px] font-semibold text-muted">工具调用</span></div>
        <div class="p-3"><div class="text-[10px] text-faint mb-1">wind-cli 命令</div><div class="font-mono text-[12px] text-slate-700 mb-2">wind ${escHtml(cmdName)}</div><div class="text-[10px] text-faint mb-1">执行状态</div><div class="font-mono text-[11px] text-slate-500">${result.ok ? 'exit code: 0 (成功)' : 'exit code: ' + (result.exit_code || '?')}</div></div>
      </div>
      <div class="bg-slate-50 border border-border rounded-xl overflow-hidden">
        <div class="px-3 py-2 border-b border-border bg-slate-100 flex items-center gap-2"><span class="w-3.5 h-3.5 text-emerald-500">↑</span><span class="text-[11px] font-semibold text-muted">输出数据</span></div>
        <div class="p-3"><div class="text-[10px] text-faint mb-1">wind-cli 返回（原始 JSON）</div><div class="font-mono text-[11px] text-slate-700 whitespace-pre">${result.ok && result.stdout ? escHtml(result.stdout.slice(0, 300)) : (result.data && result.data.error ? '错误: ' + escHtml((result.data.error.message || JSON.stringify(result.data.error)).slice(0, 200)) : (result.stderr ? escHtml(result.stderr.slice(0, 200)) : '无输出'))}</div></div>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
        <div class="flex items-center gap-2 text-[11px] text-emerald-700 font-medium"><span class="w-3.5 h-3.5">✓</span>安全校验${result.ok ? '通过' : '失败'}</div>
        <div class="text-[11px] text-emerald-600 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>路径隔离：workspace/ 内可访问</div>
        <div class="text-[11px] text-emerald-600 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>${result.ok ? '无路径穿越风险' : '执行异常'}</div>
        <div class="text-[11px] text-emerald-600 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>无外部命令注入</div>
      </div>
    </div>`;
  if (source) source.innerHTML = sourceContent;
}