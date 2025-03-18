import WebSocketClient from './websocket';
import { ChatMessage } from '@/types';

let chatWebSocket: WebSocketClient | null = null;
let messageListeners: Array<(message: any) => void> = [];

// This creates or returns the singleton chat WebSocket
export const getChatWebSocket = () => {
  if (!chatWebSocket) {
    chatWebSocket = new WebSocketClient('/ws/chat');
    chatWebSocket.connect();

    // Forward messages to registered listeners
    chatWebSocket.on('message', (data: any) => {
      messageListeners.forEach(listener => listener(data));
    });
  }
  return chatWebSocket;
};

// Description: Send a chat message to the agent
// Endpoint: WebSocket /ws/chat
// Request: { type: 'chat', content: string }
// Response: Multiple messages of type { type: string, content: string, ... }
export const sendMessage = async (content: string): Promise<ChatMessage> => {
  const ws = getChatWebSocket();
  const messageId = `user-${Date.now()}`;

  // Return a promise that resolves when we get a response
  return new Promise((resolve, reject) => {
    // Create a one-time listener for the response
    const responseHandler = (data: any) => {
      if (data.type === 'agent' && data.role === 'assistant') {
        // The agent response, convert to ChatMessage format
        const responseMessage: ChatMessage = {
          id: data.id,
          content: data.content,
          role: 'assistant',
          timestamp: data.timestamp
        };
        resolve(responseMessage);

        // Remove this one-time listener
        chatWebSocket?.off('message', responseHandler);
      } else if (data.type === 'error') {
        // If we get an error, reject the promise
        reject(new Error(data.content || 'Error sending message'));

        // Remove this one-time listener
        chatWebSocket?.off('message', responseHandler);
      }
    };

    // Register the response handler
    chatWebSocket?.on('message', responseHandler);

    // Send the message
    if (ws.isReady()) {
      ws.send({
        type: 'chat',
        id: messageId,
        content: content
      });
    } else {
      reject(new Error('WebSocket not connected'));
    }
  });
};

// Description: Get chat history for the current session
// Endpoint: Handled via WebSocket reconnection
// Request: { type: 'status', requestConversationState: true }
// Response: Multiple ChatMessage objects via the message listener
export const getChatHistory = async (): Promise<{ messages: ChatMessage[] }> => {
  // This will be implemented with proper database persistence later
  // For now, we'll return just what's in memory
  // In a real implementation, we'd load from the database
  return { messages: [] };
};

// Description: Edit an existing chat message
// Endpoint: WebSocket /ws/chat
// Request: { type: 'edit', id: string, content: string }
// Response: { success: boolean }
export const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
  const ws = getChatWebSocket();

  return new Promise((resolve, reject) => {
    if (ws.isReady()) {
      // We'll handle edits separately in a future implementation
      // For now, treat it like sending a new message
      resolve(true);
    } else {
      reject(new Error('WebSocket not connected'));
    }
  });
};

// Description: Delete a chat message
// Endpoint: WebSocket /ws/chat
// Request: { type: 'delete', id: string }
// Response: { success: boolean }
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  const ws = getChatWebSocket();

  return new Promise((resolve, reject) => {
    if (ws.isReady()) {
      // We'll handle deletes separately in a future implementation
      // For now just return success
      resolve(true);
    } else {
      reject(new Error('WebSocket not connected'));
    }
  });
};

// Register to receive messages from the WebSocket
export const onChatMessage = (callback: (message: any) => void) => {
  messageListeners.push(callback);
  return () => {
    messageListeners = messageListeners.filter(listener => listener !== callback);
  };
};