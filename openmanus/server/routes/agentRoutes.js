const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');
const { WebSocketServer } = require('ws');

// REST API routes
router.get('/chat/history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`Getting chat history for project: ${projectId}`);
    const messages = await agentService.getChatHistory(projectId);
    res.json({ messages });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat/edit/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    console.log(`Editing message ${messageId} with new content`);

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const success = await agentService.editMessage(messageId, content);

    if (success) {
      console.log(`Successfully edited message ${messageId}`);
      res.json({ success: true });
    } else {
      console.log(`Failed to edit message ${messageId} - not found or could not be updated`);
      res.status(404).json({ error: 'Message not found or could not be updated' });
    }
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/chat/message/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    console.log(`Deleting message ${messageId}`);
    const success = await agentService.deleteMessage(messageId);

    if (success) {
      console.log(`Successfully deleted message ${messageId}`);
      res.json({ success: true });
    } else {
      console.log(`Failed to delete message ${messageId} - not found or could not be deleted`);
      res.status(404).json({ error: 'Message not found or could not be deleted' });
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Setup WebSocket for agent communication
const setupAgentWebSocket = (server) => {
  const wss = new WebSocketServer({
    server,
    path: '/ws/agent'
  });

  wss.on('connection', (ws, req) => {
    try {
      // Extract session ID from query parameters
      const url = new URL(req.url, 'http://localhost');
      const sessionId = url.searchParams.get('sessionId') ||
                        Date.now().toString(36) + Math.random().toString(36).substring(2);

      console.log(`New WebSocket connection established. Session ID: ${sessionId}`);

      // Register the connection
      agentService.addConnection(sessionId, ws);

      // Handle messages from the client
      ws.on('message', async (message) => {
        try {
          console.log(`Received message from client (session ${sessionId})`);
          await agentService.handleClientMessage(sessionId, message.toString());
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to process message: ${error.message}`
          }));
        }
      });

      // Handle WebSocket closure
      ws.on('close', () => {
        console.log(`WebSocket connection closed. Session ID: ${sessionId}`);
        agentService.removeConnection(sessionId);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        agentService.removeConnection(sessionId);
      });
    } catch (error) {
      console.error('Error setting up agent WebSocket:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to initialize agent connection: ${error.message}`
      }));
    }
  });
};

module.exports = { router, setupAgentWebSocket };