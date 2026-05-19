// System prompt
const SYSTEM_PROMPT = `You are winwork, an AI assistant that helps users manage files.

Available operations:
- ls [path]: List directory contents
- read <file>: Read file content
- write <file> --stdin: Write file content (CRITICAL for saving deliverables)
- mkdir <path>: Create directory
- wiki ingest <path>: Index file to knowledge base

IMPORTANT:
1. When user asks to create code, documents, or any content that should be saved, ALWAYS use the write command
2. After writing, consider if wiki ingest is needed for documents/tutorials
3. Always wrap commands in [Executes: ...] format
4. Response in Chinese`;

class ApiClient {
  constructor() {
    this.baseUrl = localStorage.getItem('winwork_api_base_url') || 'https://df.dawnloadai.com:9888/v1';
    this.model = localStorage.getItem('winwork_api_model') || 'MiniMax-M2.7-highspeed';
    this.apiKey = this.loadApiKey();
  }

  loadApiKey() {
    // XOR obfuscation decode
    const stored = localStorage.getItem('minimax_api_key_obf');
    if (!stored) return '';
    try {
      const b64 = atob(stored);
      const k = 'winwork_v029_xor';
      let out = '';
      for (let i = 0; i < b64.length; i++) {
        out += String.fromCharCode(b64.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      }
      return out;
    } catch (e) { return ''; }
  }

  saveApiKey(key) {
    if (!key) {
      localStorage.removeItem('minimax_api_key_obf');
      return;
    }
    const k = 'winwork_v029_xor';
    let out = '';
    for (let i = 0; i < key.length; i++) {
      out += String.fromCharCode(key.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    localStorage.setItem('minimax_api_key_obf', btoa(out));
  }

  async chat(message) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

const api = new ApiClient();