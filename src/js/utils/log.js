// 日志系统
class Logger {
  constructor(maxSize = 500) {
    this.buffer = [];
    this.operations = [];
    this.maxSize = maxSize;
    this.listeners = [];
  }

  log(level, source, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,      // 'info' | 'warn' | 'error' | 'debug'
      source,    // 'app' | 'api' | 'wind' | 'ui' | 'user'
      message
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    // 通知监听器
    this.listeners.forEach(fn => fn(entry));

    // 控制台输出
    const prefix = `[${source.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message);
    } else if (level === 'warn') {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }

    return entry;
  }

  info(source, message) { return this.log('info', source, message); }
  warn(source, message) { return this.log('warn', source, message); }
  error(source, message) { return this.log('error', source, message); }
  debug(source, message) { return this.log('debug', source, message); }

  getBuffer() { return this.buffer; }
  getFiltered(level) { return this.buffer.filter(e => e.level === level); }

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

  clear() {
    this.buffer = [];
    this.operations = [];
  }

  // 操作记录（用于时间线）
  addOperation(type, detail) {
    this.operations.push({
      timestamp: new Date().toISOString(),
      type,
      detail
    });
  }

  getOperations() {
    return this.operations;
  }
}

const logger = new Logger();
