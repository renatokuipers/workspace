const express = require('express');
const router = express.Router();
const terminalService = require('../services/terminalService');
const { WebSocketServer } = require('ws');

// Setup WebSocket for terminal communication
const setupTerminalWebSocket = (server) => {
  const wss = new WebSocketServer({
    server,
    path: '/ws/terminal',
    clientTracking: true
  });

  console.log('Terminal WebSocket server initialized on path: /ws/terminal');

  wss.on('connection', (ws, req) => {
    try {
      // Extract terminal ID from URL query parameters
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const terminalId = url.searchParams.get('id') || Math.random().toString(36).substring(2);
      const cols = parseInt(url.searchParams.get('cols')) || 80;
      const rows = parseInt(url.searchParams.get('rows')) || 24;

      console.log(`New terminal WebSocket connection: ID=${terminalId}, cols=${cols}, rows=${rows}`);

      // Create or get existing terminal
      const terminal = terminalService.createTerminal(terminalId, cols, rows);
      terminalService.setWebSocket(terminalId, ws);

      // Setup ping/pong for connection health monitoring
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages from client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log(`Received terminal message type: ${data.type} for terminal: ${terminalId}`);

          switch (data.type) {
            case 'input':
              // Send user input to terminal
              terminalService.handleCommand(terminalId, data.data);
              break;
            case 'resize':
              // Resize terminal
              if (terminal && data.cols && data.rows) {
                terminal.resize(data.cols, data.rows);
              }
              break;
            default:
              console.warn(`Unknown terminal message type: ${data.type}`);
          }
        } catch (error) {
          console.error('Error processing terminal message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: `Error: ${error.message}`
          }));
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log(`Terminal WebSocket closed: ${terminalId}`);
        // Keep the terminal running for potential reconnection
        // terminalService.removeTerminal(terminalId);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`Terminal WebSocket error for ${terminalId}:`, error);
      });
    } catch (error) {
      console.error('Error setting up terminal WebSocket:', error);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          data: `Failed to initialize terminal: ${error.message}`
        }));
      } catch (sendError) {
        console.error('Could not send error to client:', sendError);
      }
    }
  });

  // Set up a health check interval for WebSocket connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
    console.log('Terminal WebSocket server closed');
  });
};

// Get all terminals
router.get('/', (req, res) => {
  try {
    const terminals = terminalService.getAllTerminals();
    res.json(terminals);
  } catch (error) {
    console.error('Error getting terminals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new terminal
router.post('/', (req, res) => {
  try {
    const options = req.body || {};
    const terminal = terminalService.createTerminal(options);
    res.status(201).json(terminal);
  } catch (error) {
    console.error('Error creating terminal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get terminal info
router.get('/:id', (req, res) => {
  try {
    const terminal = terminalService.getTerminalInfo(req.params.id);
    res.json(terminal);
  } catch (error) {
    console.error(`Error getting terminal ${req.params.id}:`, error);
    res.status(404).json({ error: error.message });
  }
});

// Resize terminal
router.post('/:id/resize', (req, res) => {
  try {
    const { cols, rows } = req.body;
    
    if (!cols || !rows) {
      return res.status(400).json({ error: 'Columns and rows are required' });
    }
    
    terminalService.resizeTerminal(req.params.id, cols, rows);
    res.json({ success: true });
  } catch (error) {
    console.error(`Error resizing terminal ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Send input to terminal
router.post('/:id/input', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Input data is required' });
    }
    
    terminalService.writeToTerminal(req.params.id, data);
    res.json({ success: true });
  } catch (error) {
    console.error(`Error sending input to terminal ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Kill a terminal
router.delete('/:id', (req, res) => {
  try {
    terminalService.killTerminal(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error(`Error killing terminal ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;