const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { EventEmitter } = require('events');
const Process = require('../models/process'); // Assuming we have a Process model

// Import message protocol utilities
const { MESSAGE_TYPES, parseMessage, createMessage } = require('../utils/messageProtocol');

class ProcessManagerService extends EventEmitter {
  constructor() {
    super();
    
    // Process state
    this.pythonProcess = null;
    this.isRunning = false;
    this.currentProcessInfo = null;
    
    // Configuration
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.scriptPath = process.env.FLOW_SCRIPT_PATH || path.join(__dirname, '../../openmanus/run_flow.py');
    
    // Watchdog settings
    this.lastResponseTime = Date.now();
    this.watchdogInterval = null;
    this.watchdogTimeout = parseInt(process.env.WATCHDOG_TIMEOUT) || 60000; // 60 seconds timeout
    
    // Virtual environment configuration
    this.useVirtualEnv = process.env.USE_PYTHON_VENV === 'true';
    this.virtualEnvPath = process.env.PYTHON_VENV_PATH || path.join(__dirname, '../../../venv');
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
      console.log('Process is already running');
      return { success: true, processInfo: this.currentProcessInfo };
    }

    console.log('Starting Python process...');

    // Create a new process record in the database
    const processInfo = new Process({
      status: 'starting',
      startTime: new Date(),
      command: `${this.pythonPath} ${this.scriptPath}`,
      logs: [{ level: 'info', message: 'Starting process' }]
    });

    try {
      await processInfo.save();
      this.currentProcessInfo = processInfo;

      // Determine Python executable path
      let pythonExecutable = this.pythonPath;
      let extraEnv = {};

      if (this.useVirtualEnv) {
        // Check if virtual environment exists
        const venvPythonPath = process.platform === 'win32'
          ? path.join(this.virtualEnvPath, 'Scripts', 'python.exe')
          : path.join(this.virtualEnvPath, 'bin', 'python');

        if (fs.existsSync(venvPythonPath)) {
          pythonExecutable = venvPythonPath;
          console.log(`Using Python from virtual environment: ${pythonExecutable}`);

          // Add virtual environment to PATH
          const venvBinPath = path.dirname(venvPythonPath);
          extraEnv.PATH = `${venvBinPath}${path.delimiter}${process.env.PATH}`;
        } else {
          console.warn(`Virtual environment not found at ${this.virtualEnvPath}, using system Python`);
        }
      }

      // Check if script exists
      if (!fs.existsSync(this.scriptPath)) {
        const error = new Error(`Python script not found at ${this.scriptPath}`);
        console.error('Error starting Python process:', error);
        
        await Process.findByIdAndUpdate(processInfo._id, {
          status: 'error',
          $push: { logs: { level: 'error', message: error.message } }
        });
        
        return { success: false, error: error.message };
      }

      // Launch the Python process
      const args = [this.scriptPath];
      
      this.pythonProcess = spawn(pythonExecutable, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...extraEnv,
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8'
        }
      });

      // Setup stdout reader
      const stdoutLineReader = readline.createInterface({
        input: this.pythonProcess.stdout,
        terminal: false
      });

      // Handle stdout lines
      stdoutLineReader.on('line', (line) => {
        try {
          // Try to parse as JSON
          const parsedMessage = parseMessage(line);
          
          if (parsedMessage && parsedMessage.type) {
            // Reset watchdog timer on valid message
            this.updateWatchdog();
            
            // Emit the message to listeners
            this.emit('message', parsedMessage);
            
            // Log important messages
            if (parsedMessage.type === MESSAGE_TYPES.LOG) {
              const logLevel = parsedMessage.payload?.level || 'info';
              const logMessage = parsedMessage.payload?.message || 'No message content';
              
              Process.findByIdAndUpdate(processInfo._id, {
                $push: { logs: { level: logLevel, message: logMessage } }
              }).catch(err => console.error('Error logging message:', err));
            }
          } else {
            // Output that wasn't valid JSON
            console.log(`Python stdout: ${line}`);
          }
        } catch (error) {
          console.error('Error processing Python output:', error);
          console.log('Raw output:', line);
        }
      });

      // Handle stderr
      const stderrLineReader = readline.createInterface({
        input: this.pythonProcess.stderr,
        terminal: false
      });

      stderrLineReader.on('line', (line) => {
        console.error(`Python stderr: ${line}`);
        
        // Log error to the database
        Process.findByIdAndUpdate(processInfo._id, {
          $push: { logs: { level: 'error', message: line } }
        }).catch(err => console.error('Error logging stderr:', err));
      });

      // Handle process exit
      this.pythonProcess.on('exit', async (code, signal) => {
        console.log(`Python process exited with code ${code} and signal ${signal}`);
        
        this.isRunning = false;
        this.stopWatchdog();
        
        const exitStatus = code === 0 ? 'completed' : 'error';
        const exitMessage = `Process exited with code ${code}${signal ? ` and signal ${signal}` : ''}`;
        
        try {
          await Process.findByIdAndUpdate(processInfo._id, {
            status: exitStatus,
            endTime: new Date(),
            exitCode: code,
            $push: { logs: { level: exitStatus === 'error' ? 'error' : 'info', message: exitMessage } }
          });
        } catch (error) {
          console.error('Error updating process status on exit:', error);
        }
        
        // Emit exit event
        this.emit('exit', { code, signal, processInfo });
      });

      // Handle process error
      this.pythonProcess.on('error', async (error) => {
        console.error('Python process error:', error);
        
        this.isRunning = false;
        this.stopWatchdog();
        
        try {
          await Process.findByIdAndUpdate(processInfo._id, {
            status: 'error',
            endTime: new Date(),
            $push: { logs: { level: 'error', message: `Process error: ${error.message}` } }
          });
        } catch (dbError) {
          console.error('Error updating process status on error:', dbError);
        }
        
        // Emit error event
        this.emit('error', { error, processInfo });
      });

      // Update process info
      await Process.findByIdAndUpdate(processInfo._id, {
        status: 'running',
        pid: this.pythonProcess.pid
      });

      this.isRunning = true;
      console.log(`Python process started with PID ${this.pythonProcess.pid}`);
      
      // Start the watchdog timer
      this.startWatchdog();
      
      return {
        success: true,
        processInfo: {
          ...processInfo.toObject(),
          pid: this.pythonProcess.pid,
          status: 'running'
        }
      };
    } catch (error) {
      console.error('Error starting Python process:', error);
      
      try {
        await Process.findByIdAndUpdate(processInfo._id, {
          status: 'error',
          $push: { logs: { level: 'error', message: error.message } }
        });
      } catch (dbError) {
        console.error('Error updating process status after start error:', dbError);
      }
      
      return { success: false, error: error.message };
    }
  }

  async stop() {
    this.stopWatchdog();
    
    if (!this.isRunning || !this.pythonProcess) {
      console.log('No process to stop');
      return { success: true, message: 'No process was running' };
    }

    console.log('Stopping Python process...');
    
    try {
      // Send shutdown command to allow clean exit
      this.sendMessage({
        type: MESSAGE_TYPES.SYSTEM,
        payload: { command: 'shutdown' }
      });
      
      // Wait for graceful shutdown
      const gracefulExit = await new Promise<boolean>((resolve) => {
        // Set a timeout for force kill
        const forceKillTimeout = setTimeout(() => {
          console.log('Force killing Python process after timeout');
          resolve(false);
        }, 5000);
        
        // Listen for exit event
        this.pythonProcess.once('exit', () => {
          clearTimeout(forceKillTimeout);
          resolve(true);
        });
      });
      
      // If process didn't exit gracefully, force kill it
      if (!gracefulExit && this.pythonProcess) {
        console.log('Force killing Python process');
        this.pythonProcess.kill('SIGKILL');
      }
      
      // Update database
      await Process.findByIdAndUpdate(this.currentProcessInfo._id, {
        status: 'stopped',
        endTime: new Date(),
        $push: { logs: { level: 'info', message: 'Process stopped' } }
      });
      
      this.isRunning = false;
      this.pythonProcess = null;
      
      return { success: true, message: 'Process stopped' };
    } catch (error) {
      console.error('Error stopping Python process:', error);
      
      // Force kill as a last resort
      if (this.pythonProcess) {
        try {
          this.pythonProcess.kill('SIGKILL');
        } catch (killError) {
          console.error('Error force killing process:', killError);
        }
      }
      
      this.isRunning = false;
      this.pythonProcess = null;
      
      return { success: false, error: error.message };
    }
  }

  async restart() {
    console.log('Restarting Python process...');
    
    try {
      await this.stop();
      const result = await this.start();
      
      // Update restart count
      if (result.success && this.currentProcessInfo) {
        await Process.findByIdAndUpdate(this.currentProcessInfo._id, {
          $inc: { restartCount: 1 },
          $push: { logs: { level: 'info', message: 'Process restarted' } }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error restarting Python process:', error);
      return { success: false, error: error.message };
    }
  }

  sendMessage(message) {
    if (!this.isRunning || !this.pythonProcess) {
      console.error('Cannot send message - Python process is not running');
      return false;
    }

    try {
      const messageStr = typeof message === 'string' 
        ? message 
        : createMessage(message.type, message.payload);
        
      this.pythonProcess.stdin.write(messageStr + '\n');
      return true;
    } catch (error) {
      console.error('Error sending message to Python process:', error);
      return false;
    }
  }

  async getStatus() {
    if (!this.isRunning) {
      return { isRunning: false };
    }

    try {
      // Get updated process info from database
      const processInfo = await Process.findById(this.currentProcessInfo._id);
      
      return {
        isRunning: this.isRunning,
        processInfo: processInfo ? processInfo.toObject() : this.currentProcessInfo
      };
    } catch (error) {
      console.error('Error getting process status:', error);
      return {
        isRunning: this.isRunning,
        processInfo: this.currentProcessInfo,
        error: error.message
      };
    }
  }
}

// Create and export a singleton instance
const processManagerService = new ProcessManagerService();
module.exports = processManagerService;