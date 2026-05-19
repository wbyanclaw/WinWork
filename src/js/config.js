// ── API Key Storage (obfuscated, not plaintext) ─────────────
const _apiKeyObfuscationKey = 'winwork_v029_xor';
let apiKey = '';
let apiBaseUrl = 'https://df.dawnloadai.com:9888/v1';
let apiModel = 'MiniMax-M2.7-highspeed';

function _xorObfuscate(str) {
  const k = _apiKeyObfuscationKey;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  }
  return btoa(out);
}

function _xorDeobfuscate(b64) {
  try {
    const str = atob(b64);
    const k = _apiKeyObfuscationKey;
    let out = '';
    for (let i = 0; i < str.length; i++) {
      out += String.fromCharCode(str.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    return out;
  } catch (e) { return ''; }
}

function _loadApiKey() {
  const stored = localStorage.getItem('minimax_api_key_obf');
  return stored ? _xorDeobfuscate(stored) : '';
}

function _saveApiKey(key) {
  if (key) localStorage.setItem('minimax_api_key_obf', _xorObfuscate(key));
  else localStorage.removeItem('minimax_api_key_obf');
}

function _loadBaseUrl() {
  return localStorage.getItem('winwork_api_base_url') || apiBaseUrl;
}

function _saveBaseUrl(url) {
  localStorage.setItem('winwork_api_base_url', url);
}

function _loadModel() {
  return localStorage.getItem('winwork_api_model') || apiModel;
}

function _saveModel(model) {
  localStorage.setItem('winwork_api_model', model);
}

function loadApiConfig() {
  apiKey = _loadApiKey();
  apiBaseUrl = _loadBaseUrl();
  apiModel = _loadModel();
}

// ── API Key UI ─────────────────────────────────────────────
function showApiKeyModal() {
  document.getElementById('apiKeyModal').classList.remove('hidden');
  document.getElementById('apiKeyInput').value = apiKey;
  document.getElementById('apiBaseUrlInput').value = apiBaseUrl;
  document.getElementById('apiModelInput').value = apiModel;
}

function hideApiKeyModal() {
  document.getElementById('apiKeyModal').classList.add('hidden');
}

function saveApiKey() {
  apiKey = document.getElementById('apiKeyInput').value.trim();
  apiBaseUrl = document.getElementById('apiBaseUrlInput').value.trim();
  apiModel = document.getElementById('apiModelInput').value.trim();
  _saveApiKey(apiKey);
  _saveBaseUrl(apiBaseUrl);
  _saveModel(apiModel);
  saveGlobalState();
  updateApiKeyStatus();
  hideApiKeyModal();
}

function clearApiKey() {
  apiKey = '';
  _saveApiKey('');
  document.getElementById('apiKeyInput').value = '';
  updateApiKeyStatus();
}

function updateApiKeyStatus() {
  const status = document.getElementById('apiKeyStatus');
  const btn = document.getElementById('apiKeyBtn');
  if (apiKey) {
    if (status) status.textContent = 'AI 已启用';
    if (btn) btn.classList.add('text-emerald-600');
  } else {
    if (status) status.textContent = '设置API';
    if (btn) btn.classList.remove('text-emerald-600');
  }
}