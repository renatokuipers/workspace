const { spawn } = require('child_process');
const path = require('path');
const { MESSAGE_TYPES, parseMessage, createMessage } = require('../utils/messageProtocol');
const Conversation = require('../models/Conversation');
const { resolvePythonScriptPath, resolvePythonPath } = require('../utils/pathResolver');

class AgentService {
  constructor() {
    this.connections = new Map(); // Map of client connections by sessionId
    this.agents = new Map(); // Map of agent processes by sessionId
    this.buffers = new Map(); // Map of message buffers by sessionId
    this.pingIntervals = new Map(); // Map of ping intervals by sessionId
  }

  // Add a WebSocket connection for a session
  addConnection(sessionId, ws) {
    console.log(`Adding new WebSocket connection for session ${sessionId}`);
    this.connections.set(sessionId, ws);

    // Initialize buffer for this session
    this.buffers.set(sessionId, '');

    // Setup ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) { // OPEN
        console.log(`Sending ping to client ${sessionId}`);
        ws.ping();
      } else {
        console.log(`Cannot ping client ${sessionId}, WebSocket is not open (state: ${ws.readyState})`);
        this.clearPingInterval(sessionId);
      }
    }, 30000); // Ping every 30 seconds

    this.pingIntervals.set(sessionId, pingInterval);

    // Inform client that connection is established
    this.sendToClient(sessionId, {
      type: 'connection',
      status: 'established',
      sessionId
    });

    return true;
  }

  // Clear ping interval for a session
  clearPingInterval(sessionId) {
    if (this.pingIntervals.has(sessionId)) {
      clearInterval(this.pingIntervals.get(sessionId));
      this.pingIntervals.delete(sessionId);
      console.log(`Cleared ping interval for session ${sessionId}`);
    }
  }

  // Remove a connection
  removeConnection(sessionId) {
    console.log(`Removing connection for session ${sessionId}`);

    // Kill any running agent process
    this.stopAgent(sessionId);

    // Clear ping interval
    this.clearPingInterval(sessionId);

    // Remove the connection and buffer
    this.connections.delete(sessionId);
    this.buffers.delete(sessionId);

    console.log(`Connection resources cleaned up for session ${sessionId}`);
  }

  // Start an agent process
  async startAgent(sessionId, initialMessage = null) {
    try {
      // Don't start a new agent if one is already running for this session
      if (this.agents.has(sessionId)) {
        console.log(`Agent already running for session ${sessionId}`);
        return true;
      }

      const pythonPath = resolvePythonPath();
      const scriptPath = resolvePythonScriptPath('run_flow.py');

      if (!pythonPath || !scriptPath) {
        throw new Error('Could not resolve Python paths');
      }

      console.log(`Starting agent process for session ${sessionId} with Python path: ${pythonPath} and script path: ${scriptPath}`);

      // Spawn the Python process
      const agentProcess = spawn(pythonPath, [scriptPath], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      // Store the process
      this.agents.set(sessionId, agentProcess);

      // Set up event handlers for the process
      agentProcess.stdout.on('data', (data) => this.handleAgentOutput(sessionId, data));
      agentProcess.stderr.on('data', (data) => this.handleAgentError(sessionId, data));

      agentProcess.on('close', (code) => {
        console.log(`Agent process exited with code ${code} for session ${sessionId}`);
        this.agents.delete(sessionId);

        this.sendToClient(sessionId, {
          type: 'agent',
          status: 'stopped',
          exitCode: code
        });
      });

      // Check immediately if the WebSocket is still connected
      if (!this.isClientConnected(sessionId)) {
        console.log(`Client for session ${sessionId} is no longer connected, stopping agent`);
        this.stopAgent(sessionId);
        return false;
      }

      // If we have an initial message, send it to the agent
      if (initialMessage) {
        await this.sendToAgent(sessionId, initialMessage);
      }

      console.log(`Agent process started successfully for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Error starting agent for session ${sessionId}:`, error);
      this.sendToClient(sessionId, {
        type: 'error',
        message: `Failed to start agent: ${error.message}`
      });
      return false;
    }
  }

  // Check if client is still connected
  isClientConnected(sessionId) {
    const ws = this.connections.get(sessionId);
    return ws && ws.readyState === 1; // 1 = WebSocket.OPEN
  }

  // Stop an agent process
  stopAgent(sessionId) {
    const agentProcess = this.agents.get(sessionId);
    if (agentProcess) {
      try {
        console.log(`Stopping agent process for session ${sessionId}`);
        // Try to gracefully terminate first
        agentProcess.kill('SIGTERM');

        // Set a timeout to force kill if it doesn't exit
        setTimeout(() => {
          if (this.agents.has(sessionId)) {
            console.log(`Force killing agent process for session ${sessionId}`);
            agentProcess.kill('SIGKILL');
            this.agents.delete(sessionId);
          }
        }, 5000);

        return true;
      } catch (error) {
        console.error(`Error stopping agent for session ${sessionId}:`, error);
        return false;
      }
    }
    return false;
  }

  // Send a message to the agent
  async sendToAgent(sessionId, message) {
    const agentProcess = this.agents.get(sessionId);

    if (!agentProcess) {
      console.log(`No agent process found for session ${sessionId}, starting a new one`);
      // Start the agent if it's not running
      const started = await this.startAgent(sessionId, message);
      if (!started) {
        throw new Error('Failed to start agent process');
      }
      return true;
    }

    try {
      // Check if the process stdin is writable
      if (!agentProcess.stdin.writable) {
        console.error(`Agent process stdin is not writable for session ${sessionId}`);
        return false;
      }

      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      console.log(`Sending message to agent for session ${sessionId}: ${messageStr.substring(0, 100)}...`);
      agentProcess.stdin.write(messageStr + '\n');
      return true;
    } catch (error) {
      console.error(`Error sending message to agent for session ${sessionId}:`, error);
      return false;
    }
  }

  // Send a message to the client
  sendToClient(sessionId, message) {
    const ws = this.connections.get(sessionId);
    if (ws && ws.readyState === 1) { // 1 = WebSocket.OPEN
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        console.log(`Sending message to client for session ${sessionId}: ${messageStr.substring(0, 100)}...`);
        ws.send(messageStr);
        return true;
      } catch (error) {
        console.error(`Error sending message to client for session ${sessionId}:`, error);
        return false;
      }
    }
    console.log(`Cannot send message to client for session ${sessionId}: WebSocket not open (state: ${ws?.readyState})`);
    return false;
  }

  // Handle a message from the client
  async handleClientMessage(sessionId, message) {
    try {
      console.log(`Received message from client for session ${sessionId}: ${message.substring(0, 100)}...`);

      let parsedMessage;
      try {
        parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
      } catch (error) {
        console.error(`Failed to parse message from client ${sessionId}:`, error);
        this.sendToClient(sessionId, {
          type: 'error',
          message: 'Invalid message format'
        });
        return false;
      }

      // Handle ping/pong messages
      if (parsedMessage.type === 'ping') {
        console.log(`Received ping from client ${sessionId}`);
        this.sendToClient(sessionId, { type: 'pong', timestamp: Date.now() });
        return true;
      }

      // Store user message in the database
      if (parsedMessage.type === 'chat' && parsedMessage.content) {
        await this.storeMessage({
          id: parsedMessage.id || Date.now().toString(36) + Math.random().toString(36).substring(2),
          role: 'user',
          content: parsedMessage.content,
          projectId: parsedMessage.projectId
        });
      }

      // Send the message to the agent
      await this.sendToAgent(sessionId, parsedMessage);

      return true;
    } catch (error) {
      console.error(`Error handling client message for session ${sessionId}:`, error);
      this.sendToClient(sessionId, {
        type: 'error',
        message: `Error processing message: ${error.message}`
      });
      return false;
    }
  }

  // Handle output from the agent process
  handleAgentOutput(sessionId, data) {
    try {
      const dataStr = data.toString();
      console.log(`Received output from agent for session ${sessionId}: ${dataStr.substring(0, 100)}...`);

      // Add data to the buffer for this session
      const buffer = this.buffers.get(sessionId) + dataStr;
      this.buffers.set(sessionId, buffer);

      // Process complete messages in the buffer
      const messages = buffer.split('\n');

      // Keep the last (potentially incomplete) message in the buffer
      if (messages.length > 0) {
        this.buffers.set(sessionId, messages.pop());
      }

      // Process all complete messages
      for (const messageStr of messages) {
        if (messageStr.trim()) {
          this.processAgentMessage(sessionId, messageStr);
        }
      }
    } catch (error) {
      console.error(`Error handling agent output for session ${sessionId}:`, error);
    }
  }

  // Handle errors from the agent process
  handleAgentError(sessionId, data) {
    const errorStr = data.toString();
    console.error(`Agent error for session ${sessionId}: ${errorStr}`);
    this.sendToClient(sessionId, {
      type: 'error',
      message: `Agent error: ${errorStr}`
    });
  }

  // Process a message from the agent
  async processAgentMessage(sessionId, messageStr) {
    try {
      console.log(`Processing agent message for session ${sessionId}: ${messageStr.substring(0, 100)}...`);

      let message;
      try {
        message = parseMessage(messageStr);
      } catch (error) {
        console.error(`Failed to parse message from agent for session ${sessionId}:`, error);
        return;
      }

      if (!message) {
        console.warn(`Received invalid message from agent for session ${sessionId}:`, messageStr);
        return;
      }

      // If this is an assistant message, store it in the database
      if ((message.type === 'chat' || message.type === MESSAGE_TYPES.FLOW) &&
          message.payload && message.payload.role === 'assistant') {
        await this.storeMessage({
          id: message.payload.id || Date.now().toString(36) + Math.random().toString(36).substring(2),
          role: 'assistant',
          content: message.payload.content,
          projectId: message.payload.projectId
        });
      }

      // Forward the message to the client
      this.sendToClient(sessionId, message);

    } catch (error) {
      console.error(`Error processing agent message for session ${sessionId}:`, error);
    }
  }

  // Store a message in the database
  async storeMessage({ id, role, content, projectId }) {
    try {
      console.log(`Storing ${role} message with ID ${id} for project ${projectId || 'default'}`);

      // Find or create a conversation
      let conversation = await Conversation.findOne({ projectId });

      if (!conversation) {
        console.log(`Creating new conversation for project ${projectId || 'default'}`);
        conversation = new Conversation({
          projectId,
          messages: []
        });
      }

      // Add the message to the conversation
      conversation.messages.push({
        id,
        role,
        content,
        timestamp: new Date()
      });

      // Update conversation timestamp
      conversation.updatedAt = new Date();

      // Save the conversation
      await conversation.save();
      console.log(`Message stored successfully for project ${projectId || 'default'}`);

      return true;
    } catch (error) {
      console.error('Error storing message:', error);
      return false;
    }
  }

  // Get chat history for a project
  async getChatHistory(projectId) {
    try {
      console.log(`Getting chat history for project ${projectId || 'default'}`);
      const conversation = await Conversation.findOne({ projectId });

      if (!conversation) {
        console.log(`No conversation found for project ${projectId || 'default'}`);
        return [];
      }

      console.log(`Found ${conversation.messages.length} messages for project ${projectId || 'default'}`);
      return conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      console.error(`Error getting chat history for project ${projectId || 'default'}:`, error);
      return [];
    }
  }

  // Edit a message
  async editMessage(messageId, newContent) {
    try {
      console.log(`Editing message with ID ${messageId}`);
      const result = await Conversation.updateOne(
        { 'messages.id': messageId },
        { $set: { 'messages.$.content': newContent } }
      );

      if (result.modifiedCount > 0) {
        console.log(`Successfully edited message with ID ${messageId}`);
        return true;
      } else {
        console.log(`Message with ID ${messageId} not found or not modified`);
        return false;
      }
    } catch (error) {
      console.error(`Error editing message with ID ${messageId}:`, error);
      return false;
    }
  }

  // Delete a message
  async deleteMessage(messageId) {
    try {
      console.log(`Deleting message with ID ${messageId}`);
      const result = await Conversation.updateOne(
        { 'messages.id': messageId },
        { $pull: { messages: { id: messageId } } }
      );

      if (result.modifiedCount > 0) {
        console.log(`Successfully deleted message with ID ${messageId}`);
        return true;
      } else {
        console.log(`Message with ID ${messageId} not found or not deleted`);
        return false;
      }
    } catch (error) {
      console.error(`Error deleting message with ID ${messageId}:`, error);
      return false;
    }
  }
}

module.exports = new AgentService();