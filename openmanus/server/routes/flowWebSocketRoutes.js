const WebSocket = require('ws');
const url = require('url');
const express = require('express');
const router = express.Router();
const processManagerService = require('../services/processManagerService');

// Active connections
const clients = new Map();

// Setup WebSocket server for flow connection
function setupFlowWebSocket(server) {
  const wss = new WebSocket.Server({
    noServer: true,
    path: '/ws/flow'
  });

  // Handle upgrade requests for flow connections
  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    const query = url.parse(request.url, true).query;

    if (pathname === '/ws/flow') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, query);
      });
    }
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws, request, query) => {
    try {
      const sessionId = query?.sessionId || `session_${Date.now()}`;
      console.log(`New flow WebSocket connection for session: ${sessionId}`);

      // Store the connection
      clients.set(ws, {
        sessionId,
        lastActivity: Date.now()
      });

      // Send connected message
      ws.send(JSON.stringify({
        type: 'system',
        content: 'Connected to flow server',
        timestamp: new Date(),
        sessionId
      }));

      // Handle messages from client
      ws.on('message', async (message) => {
        try {
          console.log(`Received flow message: ${message}`);

          // Parse the message
          const parsedMessage = JSON.parse(message);

          // Handle different message types
          switch(parsedMessage.type) {
            case 'start':
              handleStartFlow(parsedMessage, sessionId, ws);
              break;

            case 'stop':
              handleStopFlow(sessionId, ws);
              break;

            case 'input':
              handleFlowInput(parsedMessage, sessionId, ws);
              break;

            case 'status':
              handleStatusRequest(sessionId, ws);
              break;

            default:
              ws.send(JSON.stringify({
                type: 'error',
                content: `Unknown message type: ${parsedMessage.type}`,
                timestamp: new Date()
              }));
          }
        } catch (error) {
          console.error('Error handling flow message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            content: `Error processing message: ${error.message}`,
            timestamp: new Date()
          }));
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log(`Flow WebSocket closed for session: ${sessionId}`);
        clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`Flow WebSocket error: ${error.message}`);
      });

      // Set up ping/pong for connection health check
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Clean up ping interval on close
      ws.on('close', () => {
        clearInterval(pingInterval);
      });

    } catch (error) {
      console.error('Error setting up flow WebSocket:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          content: `Connection error: ${error.message}`
        }));
        ws.close();
      }
    }
  });

  return wss;
}

// Helper to handle starting a flow process
async function handleStartFlow(message, sessionId, ws) {
  try {
    // Before starting the process, check if the Python script exists
    const { resolvePythonPath, resolveScriptPath } = require('../utils/pathResolver');

    // Try to find the Python interpreter
    let pythonPath;
    try {
      pythonPath = await resolvePythonPath();
      console.log(`Python path resolved: ${pythonPath}`);
    } catch (error) {
      console.error('Error resolving Python path:', error);

      // Send a proper start_result message (not just an error) so client can resolve the promise
      ws.send(JSON.stringify({
        type: 'start_result',
        payload: {
          success: false,
          error: `Python interpreter not found. Please install Python and set the correct path in PYTHON_PATH environment variable. Error: ${error.message}`
        },
        timestamp: new Date()
      }));
      return; // Exit early
    }

    // Try to find the script
    let scriptPath;
    try {
      scriptPath = await resolveScriptPath();
      console.log(`Script path resolved: ${scriptPath}`);
    } catch (error) {
      console.error('Error resolving script path:', error);

      // Send a proper start_result message (not just an error) so client can resolve the promise
      ws.send(JSON.stringify({
        type: 'start_result',
        payload: {
          success: false,
          error: `Python script not found. Please ensure openmanus/run_flow.py exists or set the correct path in FLOW_SCRIPT_PATH environment variable. Error: ${error.message}`
        },
        timestamp: new Date()
      }));
      return; // Exit early
    }

    // If we got here, both Python and the script were found, so try to start the process
    const result = await processManagerService.start();
    console.log(`Process start result: ${JSON.stringify(result)}`);

    ws.send(JSON.stringify({
      type: 'start_result',
      payload: {
        success: result.success,
        error: result.error,
        message: result.success
          ? `Flow process started with PID: ${result.pid}`
          : `Failed to start flow process: ${result.error}`
      },
      timestamp: new Date()
    }));

    // If starting was successful and there's an initial prompt, send it
    if (result.success && message.prompt) {
      await processManagerService.sendMessage({
        type: 'user_input',
        content: message.prompt
      });
    }
  } catch (error) {
    console.error('Error starting flow process:', error.stack);

    // Send a proper start_result message for any other errors
    ws.send(JSON.stringify({
      type: 'start_result',
      payload: {
        success: false,
        error: `Error starting flow: ${error.message}`
      },
      timestamp: new Date()
    }));
  }
}

// Helper to handle stopping a flow process
async function handleStopFlow(sessionId, ws) {
  try {
    const result = await processManagerService.stop();

    ws.send(JSON.stringify({
      type: 'system',
      content: result.success
        ? 'Flow process stopped successfully'
        : `Failed to stop flow process: ${result.error}`,
      success: result.success,
      timestamp: new Date()
    }));
  } catch (error) {
    console.error('Error stopping flow process:', error.stack);
    ws.send(JSON.stringify({
      type: 'error',
      content: `Error stopping flow: ${error.message}`,
      timestamp: new Date()
    }));
  }
}

// Helper to handle sending input to a flow process
async function handleFlowInput(message, sessionId, ws) {
  try {
    if (!message.content) {
      throw new Error('No content provided');
    }

    const result = await processManagerService.sendMessage({
      type: 'user_input',
      content: message.content
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    ws.send(JSON.stringify({
      type: 'system',
      content: 'Input sent to flow process',
      timestamp: new Date()
    }));
  } catch (error) {
    console.error('Error sending input to flow process:', error.stack);
    ws.send(JSON.stringify({
      type: 'error',
      content: `Error sending input: ${error.message}`,
      timestamp: new Date()
    }));
  }
}

// Helper to handle status requests
async function handleStatusRequest(sessionId, ws) {
  try {
    const status = await processManagerService.getStatus();

    ws.send(JSON.stringify({
      type: 'status',
      content: status,
      timestamp: new Date()
    }));
  } catch (error) {
    console.error('Error getting flow status:', error.stack);
    ws.send(JSON.stringify({
      type: 'error',
      content: `Error getting status: ${error.message}`,
      timestamp: new Date()
    }));
  }
}

// Helper to broadcast a message to all clients in a session
function broadcastToSession(sessionId, message) {
  const messageStr = JSON.stringify(message);

  for (const [client, data] of clients.entries()) {
    if (data.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

module.exports = { router, setupFlowWebSocket };