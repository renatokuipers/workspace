const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Store active terminal instances
const terminals = new Map();

/**
 * Terminal Service handles creating and managing terminal instances
 */
class TerminalService {
  constructor() {
    // Setup cleanup on process exit
    process.on('exit', () => {
      this.cleanupAllTerminals();
    });
  }

  /**
   * Create a new terminal instance
   * @param {Object} options - Terminal creation options
   * @param {string} [options.cwd] - Working directory for the terminal
   * @param {Object} [options.env] - Environment variables
   * @returns {Object} Terminal information
   */
  createTerminal(options = {}) {
    // Generate a unique ID for this terminal
    const terminalId = uuidv4();
    
    // Determine shell to use based on OS
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    
    // Set working directory, defaulting to user's home
    const cwd = options.cwd || options.workingDirectory || os.homedir();
    
    console.log(`Creating terminal ${terminalId} with shell: ${shell}, cwd: ${cwd}`);
    
    try {
      // Setup environment variables
      const env = { 
        ...process.env, 
        ...options.env,
        TERM: 'xterm-256color' 
      };
      
      // Spawn the process
      const termProcess = spawn(shell, [], {
        cwd: cwd,
        env: env,
        shell: false
      });
      
      if (!termProcess || !termProcess.pid) {
        throw new Error('Failed to spawn terminal process');
      }
      
      console.log(`Terminal process started with PID: ${termProcess.pid}`);
      
      // Store terminal information
      const terminal = {
        id: terminalId,
        process: termProcess,
        shell: shell,
        cwd: cwd,
        pid: termProcess.pid,
        listeners: new Set(),
        createdAt: new Date(),
        lastActivity: new Date()
      };
      
      terminals.set(terminalId, terminal);
      
      // Setup event handlers
      termProcess.on('error', (error) => {
        console.error(`Terminal ${terminalId} error:`, error);
        this.broadcastToTerminal(terminalId, {
          type: 'error',
          content: `Terminal error: ${error.message}`
        });
      });
      
      termProcess.on('exit', (code, signal) => {
        console.log(`Terminal ${terminalId} exited with code ${code}, signal: ${signal}`);
        this.broadcastToTerminal(terminalId, {
          type: 'exit',
          content: `Terminal exited with code ${code}`,
          exitCode: code,
          signal: signal
        });
        this.cleanupTerminal(terminalId);
      });
      
      return {
        id: terminalId,
        pid: termProcess.pid,
        shell: shell
      };
    } catch (error) {
      console.error('Failed to create terminal:', error);
      throw error;
    }
  }
  
  /**
   * Register a WebSocket client as a listener for a terminal
   * @param {string} terminalId - Terminal ID
   * @param {WebSocket} ws - WebSocket connection
   */
  registerClient(terminalId, ws) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    
    console.log(`Registering client for terminal ${terminalId}`);
    terminal.listeners.add(ws);
    
    // Handle WebSocket close event for cleanup
    ws.on('close', () => {
      console.log(`Client disconnected from terminal ${terminalId}`);
      terminal.listeners.delete(ws);
      
      // If no listeners left and terminal is still running, check policy
      if (terminal.listeners.size === 0) {
        // Optionally close the terminal when all clients disconnect
        // this.killTerminal(terminalId);
      }
    });
    
    // Return basic terminal info to the client
    return {
      id: terminal.id,
      pid: terminal.pid,
      shell: terminal.shell,
      cwd: terminal.cwd
    };
  }
  
  /**
   * Write data to a terminal
   * @param {string} terminalId - Terminal ID
   * @param {string} data - Data to write
   */
  writeToTerminal(terminalId, data) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    
    try {
      terminal.lastActivity = new Date();
      terminal.process.stdin.write(data);
    } catch (error) {
      console.error(`Failed to write to terminal ${terminalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Resize a terminal
   * @param {string} terminalId - Terminal ID
   * @param {number} cols - Number of columns
   * @param {number} rows - Number of rows
   */
  resizeTerminal(terminalId, cols, rows) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    
    try {
      terminal.process.stdout.columns = cols;
      terminal.process.stdout.rows = rows;
      
      // Send resize event to process if it supports it
      if (terminal.process.resize) {
        terminal.process.resize(cols, rows);
      }
    } catch (error) {
      console.error(`Failed to resize terminal ${terminalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Kill a terminal
   * @param {string} terminalId - Terminal ID
   */
  killTerminal(terminalId) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      return; // Already gone
    }
    
    try {
      console.log(`Killing terminal ${terminalId} (PID: ${terminal.pid})`);
      
      // Send SIGTERM to allow graceful shutdown
      terminal.process.kill('SIGTERM');
      
      // Force kill after timeout if still running
      setTimeout(() => {
        try {
          if (terminals.has(terminalId)) {
            console.log(`Force killing terminal ${terminalId}`);
            terminal.process.kill('SIGKILL');
            this.cleanupTerminal(terminalId);
          }
        } catch (error) {
          console.error(`Error during force kill of terminal ${terminalId}:`, error);
        }
      }, 5000);
    } catch (error) {
      console.error(`Error killing terminal ${terminalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Clean up resources for a terminal
   * @param {string} terminalId - Terminal ID
   */
  cleanupTerminal(terminalId) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      return;
    }
    
    console.log(`Cleaning up terminal ${terminalId}`);
    
    // Notify all listeners
    this.broadcastToTerminal(terminalId, {
      type: 'terminated',
      content: 'Terminal session ended'
    });
    
    // Clean up listeners
    for (const ws of terminal.listeners) {
      terminal.listeners.delete(ws);
    }
    
    // Remove from map
    terminals.delete(terminalId);
  }
  
  /**
   * Clean up all terminals
   */
  cleanupAllTerminals() {
    console.log(`Cleaning up all terminals (${terminals.size} active)`);
    for (const terminalId of terminals.keys()) {
      this.killTerminal(terminalId);
    }
  }
  
  /**
   * Broadcast a message to all listeners of a terminal
   * @param {string} terminalId - Terminal ID
   * @param {Object} message - Message to broadcast
   */
  broadcastToTerminal(terminalId, message) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      return;
    }

    const messageStr = JSON.stringify(message);
    
    for (const ws of terminal.listeners) {
      if (ws.readyState === 1) { // OPEN
        ws.send(messageStr);
      }
    }
  }
  
  /**
   * Get all terminal instances
   * @returns {Array} Array of terminal info objects
   */
  getAllTerminals() {
    const terminalList = [];
    
    for (const [id, terminal] of terminals.entries()) {
      terminalList.push({
        id: id,
        pid: terminal.pid,
        shell: terminal.shell,
        cwd: terminal.cwd,
        createdAt: terminal.createdAt,
        lastActivity: terminal.lastActivity,
        clientCount: terminal.listeners.size
      });
    }
    
    return terminalList;
  }
  
  /**
   * Get information about a specific terminal
   * @param {string} terminalId - Terminal ID
   * @returns {Object} Terminal information
   */
  getTerminalInfo(terminalId) {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    
    return {
      id: terminal.id,
      pid: terminal.pid,
      shell: terminal.shell,
      cwd: terminal.cwd,
      createdAt: terminal.createdAt,
      lastActivity: terminal.lastActivity,
      clientCount: terminal.listeners.size
    };
  }
}

// Create a singleton instance
const terminalServiceInstance = new TerminalService();

module.exports = terminalServiceInstance;