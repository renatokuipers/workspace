const express = require('express');
const router = express.Router();
const terminalService = require('../services/terminalService');
const { WebSocket, WebSocketServer } = require('ws');

const setupTerminalWebSocket = (server) => {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/terminal' // Changed from /api/terminal to /ws/terminal
  });

  wss.on('connection', (ws) => {
    try {
      const terminalId = Math.random().toString(36).substring(2);
      const terminal = terminalService.createTerminal(terminalId);
      terminalService.setWebSocket(terminalId, ws);

      // Send initial prompt
      ws.send(JSON.stringify({
        type: 'output',
        data: '\r\n\x1B[1;32mWelcome to the OpenManus Terminal.\x1B[0m\r\n$ '
      }));

      ws.on('message', (message) => {
        try {
          const { type, data } = JSON.parse(message);

          switch (type) {
            case 'input':
              terminalService.handleCommand(terminalId, data);
              break;
            case 'resize':
              if (data.cols && data.rows) {
                terminal.resize(data.cols, data.rows);
              }
              break;
            default:
              console.warn(`Unknown message type: ${type}`);
          }
        } catch (error) {
          console.error('Error handling terminal message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: 'Failed to process terminal command'
          }));
        }
      });

      ws.on('close', () => {
        terminalService.removeTerminal(terminalId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        terminalService.removeTerminal(terminalId);
      });
    } catch (error) {
      console.error('Error setting up terminal:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: 'Failed to initialize terminal'
      }));
    }
  });
};

module.exports = { router, setupTerminalWebSocket };