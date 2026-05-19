// System prompt
const SYSTEM_PROMPT = `You are winwork, an AI assistant that helps users manage files.

Available operations:
- ls [path]: List directory contents
- read <file>: Read file content
- write <file> --stdin: Write file content (CRITICAL for saving deliverables)
- mkdir <path>: Create directory
- wiki ingest <path>: Index file to knowledge base
- wiki status: Show wiki status

IMPORTANT:
1. When user asks to create code, documents, or any content that should be saved, ALWAYS use the write command
2. After writing, consider if wiki ingest is needed for documents/tutorials
3. Always wrap commands in [Executes: ...] format
4. Response in Chinese`;

class ApiClient {
  constructor() {
    // Load from localStorage or use defaults
    const storedBaseUrl = localStorage.getItem('winwork_api_base_url');
    const storedModel = localStorage.getItem('winwork_api_model');

    this.baseUrl = storedBaseUrl || 'https://platform.minimax.com/v1';
    this.model = storedModel || 'abab6.5s-chat';
    this.apiKey = this.loadApiKey();
  }

  loadApiKey() {
    const stored = localStorage.getItem('minimax_api_key_obf');
    if (!stored) return '';

    try {
      // stored is base64 encoded XOR obfuscated string
      // 1. base64 decode
      // 2. XOR each char with key to restore
      const decoded = atob(stored);
      const k = 'winwork_v029_xor';
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      }
      return result;
    } catch (e) {
      console.error('Failed to decode API key:', e);
      return '';
    }
  }

  saveApiKey(key) {
    if (!key) {
      localStorage.removeItem('minimax_api_key_obf');
      return;
    }

    try {
      // 1. XOR each char with key
      // 2. base64 encode
      const k = 'winwork_v029_xor';
      let xored = '';
      for (let i = 0; i < key.length; i++) {
        xored += String.fromCharCode(key.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      }
      localStorage.setItem('minimax_api_key_obf', btoa(xored));
    } catch (e) {
      console.error('Failed to encode API key:', e);
    }
  }

  async chat(message) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set your API key in settings.');
    }

    const url = `${this.baseUrl}/chat/completions`;
    console.log('[API] Request to:', url);
    console.log('[API] Model:', this.model);

    let response;
    try {
      response = await fetch(url, {
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
    } catch (e) {
      throw new Error(`Network error: ${e.message}. Please check your internet connection.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your API key in settings.');
      } else if (response.status === 403) {
        throw new Error('API access forbidden. Please check your API permissions.');
      } else if (response.status === 404) {
        throw new Error(`API endpoint not found: ${url}. Please check your Base URL setting.`);
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

const api = new ApiClient();
