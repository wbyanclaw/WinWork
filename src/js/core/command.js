// 命令解析与执行
const commandParser = {
  parse(text) {
    // 解析 [Executes: ...] 格式的命令
    const regex = /\[Executes:\s*([^\]]+)\]/g;
    const commands = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const cmdStr = match[1].trim();
      const parts = cmdStr.split(/\s+/);
      commands.push({
        raw: cmdStr,
        name: parts[0],
        args: parts.slice(1)
      });
    }
    return commands;
  },

  extractWritePath(cmdStr) {
    // 识别 write 命令并提取路径
    if (!cmdStr.includes('write')) return null;
    const match = cmdStr.match(/write\s+(\S+)/);
    return match ? match[1] : null;
  },

  isWikiIngest(cmdStr) {
    // 识别 wiki ingest 命令
    return cmdStr.includes('wiki') && cmdStr.includes('ingest');
  }
};

const commandExecutor = {
  async execute(cmd) {
    // 调用 Rust bridge 执行命令
    return await invoke('run_command', { args: cmd.split(/\s+/) });
  },

  async executeWithArgs(args) {
    return await invoke('run_command', { args });
  }
};