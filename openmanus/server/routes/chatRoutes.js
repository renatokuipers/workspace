const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');

// Get all chat messages
router.get('/', async (req, res) => {
  try {
    const sessions = chatService.getActiveSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get chat history for a specific session
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = chatService.getSessionHistory(sessionId);
    
    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'No messages found for this session' });
    }
    
    res.json(messages);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send a new chat message
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, type = 'user' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Create a mock response since we're not actually sending via WebSocket here
    const message = {
      type,
      content,
      timestamp: new Date(),
      sessionId
    };
    
    // Get the chat history and add the message
    const history = chatService.getSessionHistory(sessionId) || [];
    history.push(message);
    
    // Return the updated history
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 