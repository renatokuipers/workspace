class TerminalService {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(id, cols = 80, rows = 24) {
    const terminal = {
      write: (data) => {
        const ws = this.terminals.get(id)?.ws;
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'output',
            data: data
          }));
        }
      },
      onData: (callback) => {
        this.terminals.get(id).onData = callback;
      },
      resize: (cols, rows) => {
        // Implement resize logic if needed
      },
      kill: () => {
        this.terminals.delete(id);
      }
    };

    this.terminals.set(id, { 
      terminal, 
      ws: null, 
      onData: null,
      currentCommand: '',
      cursorPosition: 0
    });
    return terminal;
  }

  getTerminal(id) {
    return this.terminals.get(id)?.terminal;
  }

  setWebSocket(id, ws) {
    const terminalData = this.terminals.get(id);
    if (terminalData) {
      terminalData.ws = ws;
    }
  }

  handleCommand(id, input) {
    const terminalData = this.terminals.get(id);
    if (!terminalData?.terminal) return;

    const terminal = terminalData.terminal;

    // Handle backspace (ASCII code 127)
    if (input.charCodeAt(0) === 127) {
      if (terminalData.currentCommand.length > 0) {
        terminalData.currentCommand = terminalData.currentCommand.slice(0, -1);
        terminal.write('\b \b'); // Move back, write space, move back again
      }
      return;
    }

    // Handle regular input
    if (input === '\r') {
      // Execute command on Enter
      terminal.write('\r\n');
      const output = this.executeCommand(terminalData.currentCommand);
      terminal.write(output + '\r\n$ ');
      terminalData.currentCommand = '';
    } else {
      // Echo the character and add to current command
      terminal.write(input);
      terminalData.currentCommand += input;
    }
  }

  executeCommand(command) {
    const cmd = command.trim();
    const commands = {
      'ls': 'Documents/\nDownloads/\nPictures/\nMusic/\nVideos/',
      'pwd': '/home/user',
      'date': new Date().toString(),
      'whoami': 'user',
      'help': 'Available commands: ls, pwd, date, whoami, echo, clear, help',
      'clear': '\x1b[H\x1b[2J',
    };

    if (cmd.startsWith('echo ')) {
      return cmd.slice(5);
    }

    return commands[cmd] || `Command not found: ${cmd}\r\nType 'help' for available commands`;
  }

  removeTerminal(id) {
    const terminal = this.getTerminal(id);
    if (terminal) {
      terminal.kill();
    }
  }
}

module.exports = new TerminalService();