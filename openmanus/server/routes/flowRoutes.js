const express = require('express');
const router = express.Router();
const { MESSAGE_TYPES } = require('../utils/messageProtocol');
const processManager = require('../services/processManagerService');
const Process = require('../models/process');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { resolvePythonPath, resolveScriptPath } = require('../utils/pathResolver');

// Store active Python processes
const pythonProcesses = new Map();

// Utility to create a logger for a specific process
const createLogger = (processId) => {
  const logDir = path.join(process.cwd(), 'logs');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logPath = path.join(logDir, `process_${processId}.log`);
  const errLogPath = path.join(logDir, `process_${processId}_error.log`);
  
  // Create write streams
  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' });
  const stderrStream = fs.createWriteStream(errLogPath, { flags: 'a' });
  
  return {
    log: (message) => {
      const timestamp = new Date().toISOString();
      const formattedMsg = `[${timestamp}] ${message}\n`;
      stdoutStream.write(formattedMsg);
      console.log(`[Process ${processId}] ${message}`);
    },
    error: (message) => {
      const timestamp = new Date().toISOString();
      const formattedMsg = `[${timestamp}] ERROR: ${message}\n`;
      stderrStream.write(formattedMsg);
      console.error(`[Process ${processId}] ERROR: ${message}`);
    },
    close: () => {
      stdoutStream.end();
      stderrStream.end();
    }
  };
};

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    console.log('Health check endpoint called');
    const status = await processManager.getStatus();
    const isHealthy = status.isRunning;

    // Get a timestamp from the process to check if it's responsive
    let isResponsive = false;

    if (isHealthy) {
      try {
        console.log('Process is running, checking responsiveness');
        // Send a ping and wait for response
        const pingPromise = new Promise((resolve) => {
          const pingHandler = (data) => {
            if (data.type === MESSAGE_TYPES.STATUS && data.payload?.pong) {
              processManager.removeListener('message', pingHandler);
              resolve(true);
            }
          };

          processManager.on('message', pingHandler);

          // Remove handler after timeout
          setTimeout(() => {
            processManager.removeListener('message', pingHandler);
            resolve(false);
          }, 5000);
        });

        // Send the ping
        processManager.sendMessage({
          type: MESSAGE_TYPES.SYSTEM,
          payload: { command: 'ping' }
        });

        isResponsive = await pingPromise;
        console.log('Process responsiveness check result:', isResponsive);
      } catch (error) {
        console.error('Error checking responsiveness:', error);
        isResponsive = false;
      }
    }

    // Format response according to standard health check format
    const healthStatus = {
      status: isHealthy && isResponsive ? 'up' : 'down',
      checks: {
        processRunning: {
          status: isHealthy ? 'up' : 'down',
          details: {
            pid: status.processInfo?.pid || null
          }
        },
        processResponsive: {
          status: isResponsive ? 'up' : 'down'
        },
        uptime: {
          status: 'up',
          details: {
            startTime: status.processInfo?.startTime,
            restartCount: status.processInfo?.restartCount || 0
          }
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log('Health check response:', healthStatus);
    // Set appropriate status code
    res.status(isHealthy && isResponsive ? 200 : 503).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'down',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start process endpoint
router.get('/start-process', async (req, res) => {
  try {
    console.log('Starting process...');
    const result = await processManager.start();
    console.log('Process started successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('Error starting process:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop process endpoint
router.get('/stop-process', async (req, res) => {
  try {
    console.log('Stopping process...');
    const result = await processManager.stop();
    console.log('Process stopped successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('Error stopping process:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Restart process endpoint
router.get('/restart-process', async (req, res) => {
  try {
    console.log('Restarting process...');
    const result = await processManager.restart();
    console.log('Process restarted successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('Error restarting process:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get process logs endpoint
router.get('/logs', async (req, res) => {
  try {
    console.log('Fetching process logs...');
    
    // Get process logs from database - first try using the status
    const status = await processManager.getStatus();
    let processId = status.processInfo?._id;
    let process = null;

    // If no active process in status, try to find the most recent process
    if (!processId) {
      console.log('No active process in processManager status, looking for most recent process');
      process = await Process.findOne().sort({ createdAt: -1 });
      
      if (process) {
        console.log(`Found most recent process with ID ${process._id}`);
        processId = process._id;
      } else {
        console.log('No processes found in database');
        return res.status(404).json({
          success: false,
          error: 'No active process found'
        });
      }
    } else {
      // Find process by ID from status
      process = await Process.findById(processId);
    }

    if (!process) {
      console.log(`Process with ID ${processId} not found when trying to fetch logs`);
      return res.status(404).json({
        success: false,
        error: 'Process not found'
      });
    }

    console.log(`Successfully fetched logs for process ${processId}`);
    res.json({
      success: true,
      process: {
        id: process._id,
        status: process.status,
        startTime: process.startTime,
        endTime: process.endTime,
        pid: process.pid,
        restartCount: process.restartCount,
        logs: process.logs
      }
    });
  } catch (error) {
    console.error('Error getting process logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start the Python process
router.post('/start', async (req, res) => {
  try {
    const { initialPrompt, sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Check if a process is already running for this session
    if (pythonProcesses.has(sessionId)) {
      return res.status(409).json({ 
        error: 'Process already running for this session',
        processId: sessionId
      });
    }
    
    // Create a logger for this process
    const logger = createLogger(sessionId);
    logger.log('Starting new Python process');
    
    // Resolve paths
    const pythonPath = await resolvePythonPath();
    const scriptPath = await resolveScriptPath();
    
    logger.log(`Python path: ${pythonPath}`);
    logger.log(`Script path: ${scriptPath}`);
    
    // Prepare environment variables
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      SESSION_ID: sessionId
    };
    
    // Spawn the Python process
    const pythonProcess = spawn(pythonPath, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: env
    });
    
    if (!pythonProcess.pid) {
      logger.error('Failed to spawn Python process');
      logger.close();
      return res.status(500).json({ error: 'Failed to start Python process' });
    }
    
    logger.log(`Process started with PID: ${pythonProcess.pid}`);
    
    // Store the process info
    pythonProcesses.set(sessionId, {
      process: pythonProcess,
      logger,
      status: 'running',
      startTime: new Date(),
      pid: pythonProcess.pid,
      outputBuffer: '',
      errorBuffer: ''
    });
    
    // Set up event handlers
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      logger.log(`STDOUT: ${output.trim()}`);
      const processInfo = pythonProcesses.get(sessionId);
      if (processInfo) {
        processInfo.outputBuffer += output;
        // Keep buffer size reasonable
        if (processInfo.outputBuffer.length > 100000) {
          processInfo.outputBuffer = processInfo.outputBuffer.slice(-50000);
        }
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      logger.error(`STDERR: ${output.trim()}`);
      const processInfo = pythonProcesses.get(sessionId);
      if (processInfo) {
        processInfo.errorBuffer += output;
        // Keep buffer size reasonable
        if (processInfo.errorBuffer.length > 100000) {
          processInfo.errorBuffer = processInfo.errorBuffer.slice(-50000);
        }
      }
    });
    
    pythonProcess.on('error', (error) => {
      logger.error(`Process error: ${error.message}`);
      const processInfo = pythonProcesses.get(sessionId);
      if (processInfo) {
        processInfo.status = 'error';
        processInfo.errorMessage = error.message;
      }
    });
    
    pythonProcess.on('close', (code) => {
      logger.log(`Process exited with code ${code}`);
      const processInfo = pythonProcesses.get(sessionId);
      if (processInfo) {
        processInfo.status = code === 0 ? 'completed' : 'failed';
        processInfo.exitCode = code;
        processInfo.endTime = new Date();
      }
      logger.close();
    });
    
    // If there's an initial prompt, send it
    if (initialPrompt) {
      logger.log(`Sending initial prompt: ${initialPrompt.substring(0, 100)}...`);
      pythonProcess.stdin.write(initialPrompt + '\n');
    }
    
    // Return success response
    return res.status(201).json({
      processId: sessionId,
      pid: pythonProcess.pid,
      status: 'running',
      message: 'Python process started successfully'
    });
    
  } catch (error) {
    console.error('Error starting Python process:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Stop the Python process
router.post('/stop', (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const processInfo = pythonProcesses.get(sessionId);
    if (!processInfo) {
      return res.status(404).json({ error: 'Process not found' });
    }
    
    // Try to gracefully terminate the process
    processInfo.logger.log('Stopping Python process');
    processInfo.process.kill('SIGTERM');
    
    // Set a timeout to force kill if it doesn't terminate
    setTimeout(() => {
      try {
        if (pythonProcesses.has(sessionId) && 
            ['running', 'starting'].includes(pythonProcesses.get(sessionId).status)) {
          processInfo.logger.log('Force killing Python process');
          processInfo.process.kill('SIGKILL');
        }
      } catch (error) {
        processInfo.logger.error(`Error force killing process: ${error.message}`);
      }
    }, 5000);
    
    return res.json({
      processId: sessionId,
      status: 'stopping',
      message: 'Python process is being terminated'
    });
    
  } catch (error) {
    console.error('Error stopping Python process:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get process status
router.get('/status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const processInfo = pythonProcesses.get(sessionId);
    if (!processInfo) {
      return res.status(404).json({ error: 'Process not found' });
    }
    
    return res.json({
      processId: sessionId,
      pid: processInfo.pid,
      status: processInfo.status,
      startTime: processInfo.startTime,
      endTime: processInfo.endTime || null,
      exitCode: processInfo.exitCode || null
    });
    
  } catch (error) {
    console.error('Error getting process status:', error);
    return res.status(500).json({ error: error.message });
  }
});

// List all processes
router.get('/list', (req, res) => {
  try {
    const processList = [];
    
    for (const [sessionId, processInfo] of pythonProcesses.entries()) {
      processList.push({
        processId: sessionId,
        pid: processInfo.pid,
        status: processInfo.status,
        startTime: processInfo.startTime,
        endTime: processInfo.endTime || null
      });
    }
    
    return res.json(processList);
    
  } catch (error) {
    console.error('Error listing processes:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Send input to the Python process
router.post('/input', (req, res) => {
  try {
    const { sessionId, input } = req.body;
    
    if (!sessionId || !input) {
      return res.status(400).json({ error: 'Session ID and input are required' });
    }
    
    const processInfo = pythonProcesses.get(sessionId);
    if (!processInfo) {
      return res.status(404).json({ error: 'Process not found' });
    }
    
    if (processInfo.status !== 'running') {
      return res.status(400).json({ 
        error: `Process is not running (status: ${processInfo.status})` 
      });
    }
    
    processInfo.logger.log(`Sending input: ${input.substring(0, 100)}...`);
    processInfo.process.stdin.write(input + '\n');
    
    return res.json({
      processId: sessionId,
      status: 'input_sent',
      message: 'Input sent to Python process'
    });
    
  } catch (error) {
    console.error('Error sending input to Python process:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get process output
router.get('/output/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clear } = req.query;
    
    const processInfo = pythonProcesses.get(sessionId);
    if (!processInfo) {
      return res.status(404).json({ error: 'Process not found' });
    }
    
    const output = {
      stdout: processInfo.outputBuffer,
      stderr: processInfo.errorBuffer,
      processId: sessionId,
      status: processInfo.status
    };
    
    // Optionally clear the buffers after retrieval
    if (clear === 'true') {
      processInfo.outputBuffer = '';
      processInfo.errorBuffer = '';
    }
    
    return res.json(output);
    
  } catch (error) {
    console.error('Error getting process output:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Clean up a completed process
router.delete('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const processInfo = pythonProcesses.get(sessionId);
    if (!processInfo) {
      return res.status(404).json({ error: 'Process not found' });
    }
    
    // If the process is still running, stop it first
    if (processInfo.status === 'running') {
      processInfo.logger.log('Force stopping Python process before cleanup');
      processInfo.process.kill('SIGKILL');
    }
    
    // Clean up resources
    processInfo.logger.log('Cleaning up process resources');
    processInfo.logger.close();
    pythonProcesses.delete(sessionId);
    
    return res.json({
      processId: sessionId,
      status: 'cleaned_up',
      message: 'Process resources have been cleaned up'
    });
    
  } catch (error) {
    console.error('Error cleaning up process:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;