import api from './api';
import WebSocketClient from './websocket';

// Create a WebSocket client for agent communication
const agentWebSocket = new WebSocketClient('/ws/agent');

// Track if we're already connected
let wsConnected = false;

// Create a map to store message callbacks
const messageCallbacks = new Map();

// Initialize WebSocket connection
const initializeWebSocket = () => {
  if (wsConnected) return;

  agentWebSocket.connect();

  // Set up event listeners
  agentWebSocket.on('chat', (data) => {
    // Handle chat messages from the agent
    const callbackId = data.id;
    if (messageCallbacks.has(callbackId)) {
      const callback = messageCallbacks.get(callbackId);
      callback(data);
      messageCallbacks.delete(callbackId);
    }
  });

  agentWebSocket.on('error', (data) => {
    console.error('WebSocket error:', data.message);
  });

  wsConnected = true;
};

// Description: Send a message to the agent
// Endpoint: WebSocket /ws/agent
// Request: { type: 'chat', content: string, id: string, projectId?: string }
// Response: { id: string, role: 'assistant', content: string, timestamp: string }
export const sendMessage = (content: string, projectId?: string) => {
  initializeWebSocket();

  return new Promise((resolve) => {
    const messageId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Store callback for this message
    messageCallbacks.set(messageId, resolve);

    // Send message over WebSocket
    agentWebSocket.send({
      type: 'chat',
      content,
      id: messageId,
      projectId
    });
  });
};

// Description: Get chat history for a specific chat or project
// Endpoint: GET /api/agent/chat/history/:projectId
// Request: {}
// Response: { messages: Array<{ id: string, role: string, content: string, timestamp: string }> }
export const getChatHistory = async (projectId?: string) => {
  try {
    const response = await api.get(`/api/agent/chat/history/${projectId || 'default'}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Edit a message in the chat
// Endpoint: POST /api/agent/chat/edit/:messageId
// Request: { content: string }
// Response: { success: boolean }
export const editMessage = async (messageId: string, content: string) => {
  try {
    const response = await api.post(`/api/agent/chat/edit/${messageId}`, { content });
    return response.data.success;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a message from the chat
// Endpoint: DELETE /api/agent/chat/message/:messageId
// Request: {}
// Response: { success: boolean }
export const deleteMessage = async (messageId: string) => {
  try {
    const response = await api.delete(`/api/agent/chat/message/${messageId}`);
    return response.data.success;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};