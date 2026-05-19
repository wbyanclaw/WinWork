// 对话消息组件
class ChatView {
  constructor(container) {
    this.container = container;
    this.messages = [];
  }

  clear() {
    this.container.innerHTML = '';
    this.messages = [];
    this.saveHistory();
  }

  appendUser(text) {
    const msg = {
      type: 'user',
      content: text,
      time: new Date().toISOString()
    };
    this.messages.push(msg);

    const el = document.createElement('div');
    el.className = 'message user';
    el.innerHTML = `
      <div class="message-content">
        <div class="message-text">${escHtml(text)}</div>
        <div class="message-time">${format.time(new Date())}</div>
      </div>
      <div class="message-avatar">👤</div>
    `;
    this.container.appendChild(el);
    this.scrollToBottom();
    this.saveHistory();
  }

  appendAi(text) {
    const msg = {
      type: 'ai',
      content: text,
      time: new Date().toISOString()
    };
    this.messages.push(msg);

    const el = document.createElement('div');
    el.className = 'message ai';
    el.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-text">${sanitize.cleanAiResponse(text)}</div>
        <div class="message-time">${format.time(new Date())}</div>
      </div>
    `;
    this.container.appendChild(el);
    this.scrollToBottom();
    this.saveHistory();
  }

  appendThinking() {
    const msg = document.createElement('div');
    msg.id = 'thinking';
    msg.className = 'message ai thinking';
    msg.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <div class="message-text">正在思考...</div>
      </div>
    `;
    this.container.appendChild(msg);
    this.scrollToBottom();
  }

  updateThinking(text) {
    const thinking = document.getElementById('thinking');
    if (thinking) {
      thinking.querySelector('.message-text').innerHTML = sanitize.cleanAiResponse(text);
    }
  }

  removeThinking() {
    const thinking = document.getElementById('thinking');
    if (thinking) thinking.remove();
  }

  appendResult(resultCard) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = resultCard;
    this.container.appendChild(card);
    this.scrollToBottom();
    this.saveHistory();
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  async saveHistory() {
    try {
      await invoke('save_chat_history', { messages: this.messages });
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }

  async loadHistory() {
    try {
      const messages = await invoke('load_chat_history');
      if (messages && messages.length > 0) {
        this.messages = messages;
        this.renderMessages();
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }

  renderMessages() {
    this.container.innerHTML = '';
    for (const msg of this.messages) {
      const el = document.createElement('div');
      el.className = `message ${msg.type}`;

      if (msg.type === 'user') {
        el.innerHTML = `
          <div class="message-content">
            <div class="message-text">${escHtml(msg.content)}</div>
            <div class="message-time">${format.time(new Date(msg.time))}</div>
          </div>
          <div class="message-avatar">👤</div>
        `;
      } else {
        el.innerHTML = `
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="message-text">${sanitize.cleanAiResponse(msg.content)}</div>
            <div class="message-time">${format.time(new Date(msg.time))}</div>
          </div>
        `;
      }
      this.container.appendChild(el);
    }
    this.scrollToBottom();
  }
}
