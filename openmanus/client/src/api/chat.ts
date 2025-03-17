// openmanus/client/src/api/chat.ts
import api from './api';

// Description: Send a message to the AI agent
// Endpoint: POST /api/chat/message
// Request: { message: string }
// Response: { id: string, content: string, role: 'assistant', timestamp: string }
export const sendMessage = async (message: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: Math.random().toString(36).substr(2, 9),
        content: "I understand you want to create a new React component. I'll help you with that. Let me open the code editor.",
        role: 'assistant',
        timestamp: new Date().toISOString()
      });
    }, 1000);
  });
};

// Description: Get chat history
// Endpoint: GET /api/chat/history
// Request: {}
// Response: { messages: ChatMessage[] }
export const getChatHistory = async () => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        messages: [
          {
            id: '1',
            content: "Hello! I'm Manus, your AI assistant. How can I help you today?",
            role: 'assistant',
            timestamp: new Date().toISOString()
          }
        ]
      });
    }, 500);
  });
};

// Description: Edit a message
// Endpoint: PUT /api/chat/message/:id
// Request: { content: string }
// Response: { success: boolean }
export const editMessage = async (messageId: string, content: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 300);
  });
};

// Description: Delete a message
// Endpoint: DELETE /api/chat/message/:id
// Request: {}
// Response: { success: boolean }
export const deleteMessage = async (messageId: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 300);
  });
};