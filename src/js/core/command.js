// 命令解析与执行
const commandParser = {
  parse(text) {
    // 解析 [Executes: ...] 格式的命令，捕获命令后的内容（用于 write 命令的 stdin）
    const regex = /\[Executes:\s*([^\]]+)\]/g;
    const commands = [];
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const cmdStr = match[1].trim();
      const cmdStart = match.index + match[0].length;
      const parts = cmdStr.split(/\s+/);
      const cmdName = parts[0];

      // 提取命令后的内容（用于 write 命令）
      let stdin = null;
      if (cmdName === 'write' && match.index < text.length) {
        // 找到命令结束位置后的内容
        const afterCmd = text.slice(cmdStart).trim();

        // 查找代码块 ```...``` 格式的内容
        const codeBlockMatch = afterCmd.match(/^`{3}[\w]*\n([\s\S]*?)\n`{3}/);
        if (codeBlockMatch) {
          stdin = codeBlockMatch[1];
        } else if (afterCmd.startsWith('```') && afterCmd.endsWith('```')) {
          // 处理单行代码块
          stdin = afterCmd.slice(3, -3).trim();
        } else if (afterCmd.trim()) {
          // 如果没有代码块，直接取剩余内容作为 stdin
          stdin = afterCmd;
        }
      }

      commands.push({
        raw: cmdStr,
        name: cmdName,
        args: parts.slice(1),
        stdin: stdin
      });
      lastIndex = regex.lastIndex;
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
  async execute(cmd, stdin = null) {
    // 对于 write 命令，需要通过 stdin 传递内容
    if (cmd.startsWith('write ') && stdin !== null) {
      return await invoke('run_command_with_stdin', { args: cmd.split(/\s+/), stdin });
    }
    // 调用 Rust bridge 执行命令
    return await invoke('run_command', { args: cmd.split(/\s+/) });
  },

  async executeWithArgs(args, stdin = null) {
    return await invoke('run_command_with_stdin', { args, stdin });
  }
};