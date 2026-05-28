// 命令解析与执行

// 支持新旧两种格式：JSON Actions 和 [Executes: ...]
const commandParser = {
  parse(text) {
    // 优先尝试 JSON 格式
    const jsonResult = this.parseJsonActions(text);
    if (jsonResult.length > 0) {
      return jsonResult;
    }

    // 回退到旧格式 [Executes: ...]
    return this.parseLegacyFormat(text);
  },

  parseJsonActions(text) {
    try {
      // 匹配 ```json ... ``` 代码块
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\n```/);
      if (!jsonMatch) {
        // 尝试内联 JSON
        const inlineMatch = text.match(/\{[\s\S]*"actions"[\s\S]*\}/);
        if (!inlineMatch) return [];
      }

      const jsonStr = jsonMatch ? jsonMatch[1].trim() : inlineMatch ? inlineMatch[0] : '';
      if (!jsonStr) return [];

      const parsed = JSON.parse(jsonStr);
      if (!parsed.actions || !Array.isArray(parsed.actions)) return [];

      return parsed.actions.map(action => ({
        raw: `${action.type} ${(action.args || []).join(' ')}`,
        name: action.type,
        args: action.args || [],
        stdin: action.stdin || null,
        fromJson: true
      }));
    } catch (e) {
      console.debug('[command] JSON parse failed, falling back to legacy format');
      return [];
    }
  },

  parseLegacyFormat(text) {
    // 解析 [Executes: ...] 格式
    const regex = /\[Executes:\s*([^\]]+)\]/g;
    const commands = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const cmdStr = match[1].trim();
      const cmdStart = match.index + match[0].length;
      const parts = cmdStr.split(/\s+/);
      const cmdName = parts[0];

      let stdin = null;
      if (cmdName === 'write' && match.index < text.length) {
        const afterCmd = text.slice(cmdStart).trim();
        const codeBlockMatch = afterCmd.match(/^`{3}[\w]*\n([\s\S]*?)\n`{3}/);
        if (codeBlockMatch) {
          stdin = codeBlockMatch[1];
        } else if (afterCmd.startsWith('```') && afterCmd.endsWith('```')) {
          stdin = afterCmd.slice(3, -3).trim();
        } else if (afterCmd.trim()) {
          stdin = afterCmd;
        }
      }

      commands.push({
        raw: cmdStr,
        name: cmdName,
        args: parts.slice(1),
        stdin: stdin,
        fromJson: false
      });
    }
    return commands;
  },

  extractWritePath(cmdStr) {
    if (!cmdStr.includes('write')) return null;
    const match = cmdStr.match(/write\s+(\S+)/);
    return match ? match[1] : null;
  },

  isWikiIngest(cmdStr) {
    return cmdStr.includes('wiki') && cmdStr.includes('ingest');
  }
};

const commandExecutor = {
  async execute(raw, stdin = null) {
    // 拆分原始命令字符串
    const args = raw.split(/\s+/);
    return this.executeWithArgs(args, stdin);
  },

  async executeWithArgs(args, stdin = null) {
    return await invoke('run_command_with_stdin', { args, stdin });
  }
};