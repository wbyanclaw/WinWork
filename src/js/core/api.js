// System prompt
const SYSTEM_PROMPT = `你是一个文件管理助手。用户描述需求，你通过工具完成文件操作。
每次只调用一个工具，完成后再决定下一步。
如果需要查看命令帮助，先调用 help 命令。
Response in Chinese.`;

// 工具调用适配器 - 兼容不同 API 平台
class ToolCallAdapter {
  static parse(response) {
    // OpenAI 格式: tool_calls
    if (response.tool_calls) {
      return response.tool_calls.map(c => ({
        id: c.id,
        name: c.function.name,
        args: typeof c.function.arguments === 'string'
          ? JSON.parse(c.function.arguments)
          : c.function.arguments
      }));
    }
    // Anthropic 格式: content[type=tool_use]
    if (response.content?.[0]?.type === 'tool_use') {
      return response.content.map(c => ({
        id: c.id,
        name: c.name,
        args: c.input
      }));
    }
    // MiniMax/OpenAI 兼容格式: choices[0].message.tool_calls
    if (response.choices?.[0]?.finish_reason === 'tool_calls') {
      const msg = response.choices[0].message;
      if (msg.tool_calls) {
        return msg.tool_calls.map(c => ({
          id: c.id,
          name: c.function?.name || c.name,
          args: typeof c.function?.arguments === 'string'
            ? JSON.parse(c.function.arguments)
            : (c.function?.arguments || c.input || {})
        }));
      }
    }
    // 通用 tool_calls 检查
    if (response.choices?.[0]?.message?.tool_calls) {
      return response.choices[0].message.tool_calls.map(c => ({
        id: c.id,
        name: c.function?.name || c.name,
        args: typeof c.function?.arguments === 'string'
          ? JSON.parse(c.function.arguments)
          : (c.function?.arguments || c.input || {})
      }));
    }
    return null;
  }

  static hasToolCalls(response) {
    if (response.tool_calls) return true;
    if (response.choices?.[0]?.message?.tool_calls) return true;
    if (response.content?.some(c => c.type === 'tool_use')) return true;
    return false;
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = localStorage.getItem('winwork_api_base_url') || 'https://platform.minimax.com/v1';
    this.model = localStorage.getItem('winwork_api_model') || 'abab6.5s-chat';
    this.apiKey = this.loadApiKey();
    this.tools = [];
    this.messages = [];
  }

  loadApiKey() {
    const stored = localStorage.getItem('minimax_api_key_obf');
    if (!stored) return '';
    try {
      const decoded = atob(stored);
      const k = 'winwork_v029_xor';
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      }
      return result;
    } catch (e) {
      return '';
    }
  }

  saveApiKey(key) {
    if (!key) {
      localStorage.removeItem('minimax_api_key_obf');
      return;
    }
    try {
      const k = 'winwork_v029_xor';
      let xored = '';
      for (let i = 0; i < key.length; i++) {
        xored += String.fromCharCode(key.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      }
      localStorage.setItem('minimax_api_key_obf', btoa(xored));
    } catch (e) {}
  }

  // 初始化工具定义
  async initTools(toolDefs) {
    this.tools = toolDefs;
    console.log('[API] Tools loaded:', this.tools.length);
  }

  // 对话（支持工具调用循环）
  async chat(userMessage) {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set your API key in settings.');
    }

    // 重置消息历史
    this.messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ];

    let maxIterations = 10;
    while (maxIterations-- > 0) {
      const response = await this._chatOnce();

      if (ToolCallAdapter.hasToolCalls(response)) {
        const toolCalls = ToolCallAdapter.parse(response);
        for (const call of toolCalls) {
          // 获取 API 返回的 tool_call_id（MiniMax 格式）
          const toolCallId = call.id || call.tool_call_id || `call_${Date.now()}`;

          // 把工具调用添加到消息
          this.messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.args) }
            }]
          });

          // 执行工具（由调用方提供）
          if (this.onToolCall) {
            const result = await this.onToolCall(call.name, call.args);
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCallId,
              content: JSON.stringify(result)
            });
          }
        }
      } else {
        // 返回纯文本响应
        return response.choices?.[0]?.message?.content || response.choices?.[0]?.text || '';
      }
    }

    return '操作超时';
  }

  async _chatOnce() {
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: this.model,
      messages: this.messages,
      max_tokens: 4096,
      temperature: 0.7
    };

    // 只有有工具时才传 tools 参数
    if (this.tools.length > 0) {
      body.tools = this.tools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your API key in settings.');
      } else if (response.status === 403) {
        throw new Error('API access forbidden. Please check your API permissions.');
      } else {
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
    }

    return response.json();
  }
}

// 辅助函数：转换 windcli 工具定义为 OpenAI 格式
function convertToOpenAITool(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.params?.properties || {},
        required: tool.params?.required || []
      }
    }
  };
}

const api = new ApiClient();
