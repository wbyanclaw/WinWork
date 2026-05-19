// 对话消息组件
class ChatView {
  constructor(container) {
    this.container = container;
    this.messages = [];
  }

  clear() {
    this.container.innerHTML = '';
    this.messages = [];
  }

  appendUser(text) {
    const msg = document.createElement('div');
    msg.className = 'message user';
    msg.innerHTML = `
      <div class="message-content">
        <div class="message-text">${escHtml(text)}</div>
        <div class="message-time">${format.time(new Date())}</div>
      </div>
      <div class="message-avatar">👤</div>
    `;
    this.container.appendChild(msg);
    this.scrollToBottom();
  }

  appendAi(text) {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-text">${sanitize.cleanAiResponse(text)}</div>
        <div class="message-time">${format.time(new Date())}</div>
      </div>
    `;
    this.container.appendChild(msg);
    this.scrollToBottom();
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
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
}
