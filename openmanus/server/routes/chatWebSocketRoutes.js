const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const url = require('url');

// Store active connections
const clients = new Map();

const setupChatWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    noServer: true,
    path: '/ws/chat'
  });

  // Handle upgrade requests (HTTP -> WebSocket)
  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    const query = url.parse(request.url, true).query;
    
    if (pathname === '/ws/chat') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, query);
      });
    }
  });

  // Handle new connections
  wss.on('connection', (ws, request, query) => {
    console.log('New WebSocket connection established');
    
    // Extract session ID from query parameters or generate a new one
    const sessionId = query?.sessionId || `session_${Date.now()}`;
    console.log(`Session ID: ${sessionId}`);
    
    // Add to clients map
    clients.set(ws, {
      sessionId,
      lastActivity: Date.now()
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'system',
      content: 'Connected to chat server',
      timestamp: new Date(),
      sessionId
    }));

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        console.log(`Received message: ${message}`);
        const parsedMessage = JSON.parse(message);
        
        // Broadcast to all clients in the same session
        broadcastToSession(sessionId, {
          type: parsedMessage.type || 'user',
          content: parsedMessage.content,
          timestamp: new Date(),
          sessionId
        });
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Failed to process message: ' + error.message,
          timestamp: new Date()
        }));
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      clients.delete(ws);
    });

    // Set up ping/pong to keep connection alive
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(interval);
      }
    }, 30000);
  });

  return wss;
};

// Helper to broadcast to all clients in a session
function broadcastToSession(sessionId, message) {
  const messageStr = JSON.stringify(message);
  
  for (const [client, data] of clients.entries()) {
    if (data.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

module.exports = { router, setupChatWebSocket };