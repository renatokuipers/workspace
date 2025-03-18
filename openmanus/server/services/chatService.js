const { resolvePythonPath, resolveScriptPath } = require('../utils/pathResolver');
const Process = require('../models/process');

/**
 * Chat service responsible for handling chat sessions and messages
 */

// Store active sessions with WebSocket connections
const activeSessions = new Map();

// Store chat history for each session
const chatHistory = new Map();

// Maximum messages to keep in history per session
const MAX_HISTORY_LENGTH = 100;

class ChatService {
  constructor() {
    this.sessions = new Map();
    this.agentProcesses = new Map();
  }

  /**
   * Register a new WebSocket connection for a session
   * @param {string} sessionId - The unique session identifier
   * @param {WebSocket} ws - The WebSocket connection
   */
  registerSession(sessionId, ws) {
    console.log(`Registering session: ${sessionId}`);
    activeSessions.set(sessionId, ws);
    
    this.sessions.set(sessionId, {
      ws,
      isActive: true,
      messageQueue: [],
      lastInteraction: Date.now()
    });
    
    // Initialize chat history for this session if not exists
    if (!chatHistory.has(sessionId)) {
      chatHistory.set(sessionId, []);
    }
  }

  /**
   * Remove a session when WebSocket connection closes
   * @param {string} sessionId - The unique session identifier
   */
  unregisterSession(sessionId) {
    console.log(`Unregistering session: ${sessionId}`);
    activeSessions.delete(sessionId);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      // Keep session in map for potential reconnection but mark as inactive
      setTimeout(() => {
        // If not reconnected within 10 minutes, clean up completely
        if (!this.sessions.get(sessionId)?.isActive) {
          this.stopAgentProcess(sessionId);
          this.sessions.delete(sessionId);
        }
      }, 10 * 60 * 1000);
    }
  }

  /**
   * Handle incoming chat messages
   * @param {string} sessionId - The unique session identifier
   * @param {Object} message - The parsed message object
   * @param {WebSocket} ws - The WebSocket connection
   */
  async handleMessage(sessionId, message, ws) {
    // Validate incoming message
    if (!message.content) {
      throw new Error('Message must have content');
    }

    // Create a standardized message object
    const standardizedMessage = {
      type: message.type || 'user',
      content: message.content,
      timestamp: new Date(),
      sessionId
    };

    console.log(`Processing ${standardizedMessage.type} message for session ${sessionId}`);

    // Add to history
    const history = chatHistory.get(sessionId) || [];
    history.push(standardizedMessage);
    
    // Limit history size
    if (history.length > MAX_HISTORY_LENGTH) {
      history.shift(); // Remove oldest message
    }
    
    // Update history
    chatHistory.set(sessionId, history);

    // Send confirmation to the sender
    ws.send(JSON.stringify({
      type: 'confirmation',
      content: 'Message received',
      timestamp: new Date(),
      messageId: standardizedMessage.timestamp.getTime()
    }));

    // For user messages, trigger AI response
    if (standardizedMessage.type === 'user') {
      try {
        // Send "thinking" indicator
        ws.send(JSON.stringify({
          type: 'system',
          content: 'Processing your message...',
          timestamp: new Date()
        }));
        
        // Process with agent
        await this.processWithAgent(sessionId, standardizedMessage.content, ws);
      } catch (error) {
        console.error('Error generating AI response:', error);
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Failed to process message',
          error: error.message,
          timestamp: new Date()
        }));
      }
    }
  }

  /**
   * Get chat history for a specific session
   * @param {string} sessionId - The unique session identifier
   * @returns {Array} - Array of chat messages
   */
  getSessionHistory(sessionId) {
    return chatHistory.get(sessionId) || [];
  }

  /**
   * Get all active sessions
   * @returns {Array} - Array of session IDs
   */
  getActiveSessions() {
    return Array.from(activeSessions.keys());
  }

  async startAgentProcess(sessionId, initialPrompt = null) {
    // Check if process already exists for this session
    if (this.agentProcesses.has(sessionId)) {
      return this.agentProcesses.get(sessionId);
    }

    try {
      // Resolve paths
      const pythonPath = await resolvePythonPath();
      const scriptPath = await resolveScriptPath();

      console.log(`Starting agent process for session ${sessionId}`);
      console.log(`Python path: ${pythonPath}`);
      console.log(`Script path: ${scriptPath}`);

      // Create a new process record
      const processRecord = await Process.create({
        sessionId,
        type: 'agent',
        status: 'starting',
        startTime: new Date(),
        metadata: {
          pythonPath,
          scriptPath,
          initialPrompt
        }
      });

      // Store the process ID for this session
      this.agentProcesses.set(sessionId, processRecord._id);

      // TODO: Actually start the Python process
      // For now, just update the status
      processRecord.status = 'running';
      await processRecord.save();

      return processRecord._id;
    } catch (error) {
      console.error(`Error starting agent process for session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopAgentProcess(sessionId) {
    const processId = this.agentProcesses.get(sessionId);
    if (!processId) {
      return null;
    }

    try {
      console.log(`Stopping agent process for session ${sessionId}`);
      
      // Find the process record
      const processRecord = await Process.findById(processId);
      if (!processRecord) {
        throw new Error(`Process record not found: ${processId}`);
      }

      // TODO: Actually stop the Python process
      // For now, just update the status
      processRecord.status = 'stopped';
      processRecord.endTime = new Date();
      await processRecord.save();

      // Remove from map
      this.agentProcesses.delete(sessionId);

      return processRecord;
    } catch (error) {
      console.error(`Error stopping agent process for session ${sessionId}:`, error);
      throw error;
    }
  }

  async processWithAgent(sessionId, content, ws) {
    let processId = this.agentProcesses.get(sessionId);
    
    if (!processId) {
      // Start a new process if none exists
      processId = await this.startAgentProcess(sessionId, content);
    }

    // Simulate AI processing for now
    return new Promise((resolve) => {
      setTimeout(() => {
        const aiResponse = {
          type: 'assistant',
          content: `AI Response: ${content}`,
          timestamp: new Date(),
          sessionId
        };
        
        // Add AI response to history
        const history = chatHistory.get(sessionId) || [];
        history.push(aiResponse);
        if (history.length > MAX_HISTORY_LENGTH) {
          history.shift();
        }
        chatHistory.set(sessionId, history);
        
        // Send AI response
        ws.send(JSON.stringify(aiResponse));
        resolve(aiResponse);
      }, 2000);
    });
  }
}

// Create a singleton instance
const chatServiceInstance = new ChatService();

// Export the instance and also direct function access for simpler use
module.exports = chatServiceInstance;