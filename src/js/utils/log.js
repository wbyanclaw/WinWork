// 日志系统
class Logger {
  constructor(maxSize = 500) {
    this.buffer = [];
    this.maxSize = maxSize;
    this.listeners = [];
  }

  log(level, source, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,      // 'info' | 'warn' | 'error' | 'debug'
      source,    // 'app' | 'api' | 'wind' | 'ui'
      message
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    // 通知监听器
    this.listeners.forEach(fn => fn(entry));

    // 持久化
    this.persist(entry);

    return entry;
  }

  info(source, message) { return this.log('info', source, message); }
  warn(source, message) { return this.log('warn', source, message); }
  error(source, message) { return this.log('error', source, message); }
  debug(source, message) { return this.log('debug', source, message); }

  getBuffer() { return this.buffer; }

  getFiltered(level) {
    if (level === 'all') return this.buffer;
    return this.buffer.filter(e => e.level === level);
  }

  search(query) {
    return this.buffer.filter(e =>
      e.message.toLowerCase().includes(query.toLowerCase())
    );
  }

  onEntry(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(f => f !== fn);
    };
  }

  async persist(entry) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const key = `logs/${date}`;
      const logs = (await storage.load(key)) || [];
      logs.push(entry);
      if (logs.length > 1000) logs.shift();
      await storage.save(key, logs);
    } catch (e) {
      console.error('Failed to persist log:', e);
    }
  }

  clear() {
    this.buffer = [];
  }
}

const logger = new Logger();