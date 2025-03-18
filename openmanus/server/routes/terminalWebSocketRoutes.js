const WebSocket = require('ws');
const url = require('url');
const express = require('express');
const router = express.Router();
const terminalService = require('../services/terminalService');

// Terminal WebSocket setup
function setupTerminalWebSocket(server) {
  const wss = new WebSocket.Server({
    noServer: true,
    path: '/ws/terminal'
  });

  // Handle upgrade requests for terminal connections
  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    const query = url.parse(request.url, true).query;
    
    if (pathname === '/ws/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, query);
      });
    }
  });

  // Handle new terminal WebSocket connections
  wss.on('connection', (ws, request, query) => {
    try {
      const terminalId = query.terminalId;
      if (!terminalId) {
        console.error('WebSocket connection attempted without terminalId');
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Missing terminal ID'
        }));
        ws.close();
        return;
      }
      
      console.log(`New terminal WebSocket connection for terminal: ${terminalId}`);
      
      // Try to register this client with the terminal
      try {
        const terminalInfo = terminalService.registerClient(terminalId, ws);
        
        // Send initial connection confirmation
        ws.send(JSON.stringify({
          type: 'connected',
          content: `Connected to terminal ${terminalId}`,
          terminalInfo
        }));
      } catch (error) {
        console.error(`Error registering terminal client: ${error.message}`);
        ws.send(JSON.stringify({
          type: 'error',
          content: `Failed to connect to terminal: ${error.message}`
        }));
        ws.close();
        return;
      }
      
      // Handle incoming messages from the client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          
          switch (data.type) {
            case 'input':
              // Send user input to the terminal
              if (data.content) {
                terminalService.writeToTerminal(terminalId, data.content);
              }
              break;
              
            case 'resize':
              // Resize the terminal
              if (data.cols && data.rows) {
                terminalService.resizeTerminal(terminalId, data.cols, data.rows);
              }
              break;
              
            default:
              console.warn(`Unknown terminal message type: ${data.type}`);
          }
        } catch (error) {
          console.error(`Error handling terminal message: ${error.message}`);
          ws.send(JSON.stringify({
            type: 'error',
            content: `Error processing message: ${error.message}`
          }));
        }
      });
      
      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`Terminal WebSocket error: ${error.message}`);
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
      console.error('Error setting up terminal WebSocket:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          content: `Connection error: ${error.message}`
        }));
        ws.close();
      }
    }
  });

  // REST routes for terminal management
  router.post('/terminals', (req, res) => {
    try {
      const options = req.body || {};
      const terminal = terminalService.createTerminal(options);
      res.status(201).json(terminal);
    } catch (error) {
      console.error('Error creating terminal:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/terminals', (req, res) => {
    try {
      const terminals = terminalService.getAllTerminals();
      res.json(terminals);
    } catch (error) {
      console.error('Error getting terminals:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/terminals/:id', (req, res) => {
    try {
      const terminal = terminalService.getTerminalInfo(req.params.id);
      res.json(terminal);
    } catch (error) {
      console.error(`Error getting terminal ${req.params.id}:`, error);
      res.status(404).json({ error: error.message });
    }
  });
  
  router.delete('/terminals/:id', (req, res) => {
    try {
      terminalService.killTerminal(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error(`Error deleting terminal ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  return wss;
}

module.exports = { router, setupTerminalWebSocket }; 