const express = require('express');
const router = express.Router();
const { MESSAGE_TYPES } = require('../utils/messageProtocol');
const processManager = require('../services/processManagerService');
const Process = require('../models/process');

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const status = await processManager.getStatus();
    const isHealthy = status.isRunning;

    // Get a timestamp from the process to check if it's responsive
    let isResponsive = false;

    if (isHealthy) {
      try {
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
    // Get process logs from database
    const status = await processManager.getStatus();
    const processId = status.processInfo?._id;

    if (!processId) {
      console.log('No active process found when trying to fetch logs');
      return res.status(404).json({
        success: false,
        error: 'No active process found'
      });
    }

    // Find process and populate logs
    const process = await Process.findById(processId);

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

module.exports = router;