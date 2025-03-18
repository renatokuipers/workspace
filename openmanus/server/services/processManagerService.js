const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Import message protocol utilities
const { MESSAGE_TYPES, parseMessage, createMessage } = require('../utils/messageProtocol');
const { resolvePythonPath, resolveScriptPath } = require('../utils/pathResolver');

class ProcessManagerService {
  constructor() {
    // Process state
    this.process = null;
    this.processInfo = null;
    this.outputBuffer = '';
    this.errorBuffer = '';
    this.messageHandlers = new Map();
    this.isRunning = false;
    this.logger = this.createLogger();
  }

  createLogger() {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, 'process_manager.log');
    const errLogPath = path.join(logDir, 'process_manager_error.log');
    
    // Create write streams
    const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(errLogPath, { flags: 'a' });
    
    return {
      log: (message) => {
        const timestamp = new Date().toISOString();
        const formattedMsg = `[${timestamp}] ${message}\n`;
        stdoutStream.write(formattedMsg);
        console.log(`[ProcessManager] ${message}`);
      },
      error: (message) => {
        const timestamp = new Date().toISOString();
        const formattedMsg = `[${timestamp}] ERROR: ${message}\n`;
        stderrStream.write(formattedMsg);
        console.error(`[ProcessManager] ERROR: ${message}`);
      },
      close: () => {
        stdoutStream.end();
        stderrStream.end();
      }
    };
  }

  startWatchdog() {
    // Clear any existing watchdog
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }

    this.lastResponseTime = Date.now();

    this.watchdogInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastResponse = now - this.lastResponseTime;

      // If process is running but hasn't responded in watchdogTimeout ms
      if (this.isRunning && timeSinceLastResponse > this.watchdogTimeout) {
        console.warn(`Watchdog: Python process unresponsive for ${timeSinceLastResponse}ms`);

        // Log the issue
        Process.findByIdAndUpdate(this.currentProcessInfo._id, {
          $push: {
            logs: {
              level: 'warning',
              message: `Process unresponsive for ${timeSinceLastResponse}ms, sending ping`
            }
          }
        }).catch(err => console.error('Error logging watchdog alert:', err));

        // Send a ping message to check if process is responsive
        try {
          this.sendMessage({
            type: MESSAGE_TYPES.SYSTEM,
            payload: { command: 'ping' }
          });

          // If no response in 5 more seconds, restart the process
          setTimeout(() => {
            const newTimeSinceLastResponse = Date.now() - this.lastResponseTime;

            if (newTimeSinceLastResponse > timeSinceLastResponse) {
              console.error('Watchdog: Process failed to respond to ping, restarting');

              Process.findByIdAndUpdate(this.currentProcessInfo._id, {
                $push: {
                  logs: {
                    level: 'error',
                    message: 'Process unresponsive and failed to respond to ping, forcing restart'
                  }
                }
              }).catch(err => console.error('Error logging watchdog restart:', err));

              this.restart();
            }
          }, 5000);
        } catch (error) {
          console.error('Watchdog: Error sending ping, restarting process:', error);
          this.restart();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  // Update this method to reset the watchdog timer on any successful message
  updateWatchdog() {
    this.lastResponseTime = Date.now();
  }

  async start() {
    if (this.isRunning) {
      this.logger.log('Process is already running');
      return { success: true, message: 'Process is already running' };
    }

    try {
      // Get Python and script paths
      const pythonPath = await resolvePythonPath();
      const scriptPath = await resolveScriptPath();

      this.logger.log(`Starting Python process with: ${pythonPath} ${scriptPath}`);

      // Prepare environment
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1'  // Ensures Python output is unbuffered
      };

      // Spawn process
      this.process = spawn(pythonPath, [scriptPath], {
        cwd: path.dirname(scriptPath),
        env: env
      });

      if (!this.process || !this.process.pid) {
        throw new Error('Failed to spawn Python process');
      }

      this.logger.log(`Process started with PID: ${this.process.pid}`);
      
      // Reset buffers
      this.outputBuffer = '';
      this.errorBuffer = '';
      this.isRunning = true;

      // Set up event handlers
      this.process.stdout.on('data', (data) => this.handleStdout(data));
      this.process.stderr.on('data', (data) => this.handleStderr(data));
      
      this.process.on('error', (error) => {
        this.logger.error(`Process error: ${error.message}`);
        this.isRunning = false;
      });
      
      this.process.on('close', (code) => {
        this.logger.log(`Process exited with code ${code}`);
        this.isRunning = false;
      });

      return { 
        success: true, 
        message: 'Python process started successfully',
        pid: this.process.pid
      };
    } catch (error) {
      this.logger.error(`Error starting process: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async stop() {
    if (!this.isRunning || !this.process) {
      return { success: true, message: 'No running process to stop' };
    }

    try {
      this.logger.log('Stopping Python process...');
      
      // Send SIGTERM first for graceful shutdown
      this.process.kill('SIGTERM');
      
      // Set a timeout to force kill if necessary
      const killTimeout = setTimeout(() => {
        if (this.isRunning) {
          this.logger.log('Force killing process with SIGKILL');
          this.process.kill('SIGKILL');
        }
      }, 5000);
      
      // Wait for process to exit
      return new Promise((resolve) => {
        this.process.once('close', (code) => {
          clearTimeout(killTimeout);
          this.isRunning = false;
          this.logger.log(`Process stopped with exit code: ${code}`);
          resolve({ success: true, message: `Process stopped with exit code: ${code}` });
        });
      });
    } catch (error) {
      this.logger.error(`Error stopping process: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  handleStdout(data) {
    const output = data.toString();
    this.logger.log(`STDOUT: ${output.trim()}`);
    this.outputBuffer += output;
    
    // Keep buffer size reasonable
    if (this.outputBuffer.length > 100000) {
      this.outputBuffer = this.outputBuffer.slice(-50000);
    }
  }

  handleStderr(data) {
    const output = data.toString();
    this.logger.error(`STDERR: ${output.trim()}`);
    this.errorBuffer += output;
    
    // Keep buffer size reasonable
    if (this.errorBuffer.length > 100000) {
      this.errorBuffer = this.errorBuffer.slice(-50000);
    }
  }

  async sendMessage(message) {
    if (!this.isRunning || !this.process) {
      return { success: false, error: 'No running process to send message to' };
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      this.logger.log(`Sending message: ${messageStr.substring(0, 100)}...`);
      
      this.process.stdin.write(messageStr + '\n');
      return { success: true, message: 'Message sent' };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getStatus() {
    return {
      success: true,
      isRunning: this.isRunning,
      pid: this.process?.pid,
      uptime: this.process && this.isRunning ? process.uptime() : 0
    };
  }

  async getLogs() {
    return {
      stdout: this.outputBuffer,
      stderr: this.errorBuffer
    };
  }

  async restart() {
    try {
      await this.stop();
      return await this.start();
    } catch (error) {
      console.error('Error restarting Python process:', error);
      return { success: false, error: error.message };
    }
  }
}

const processManagerService = new ProcessManagerService();
module.exports = processManagerService;