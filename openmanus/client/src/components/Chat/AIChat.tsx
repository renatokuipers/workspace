import React, { useState, useEffect, useRef } from 'react';
import useFlowWebSocket from '../../hooks/useFlowWebSocket';
import { FlowMessage, FlowStatus } from '../../api/flowWebSocket';
import './AIChat.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'received' | 'error';
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Set up WebSocket hook
  const {
    connected,
    status,
    messages: wsMessages,
    error,
    startProcess,
    stopProcess,
    sendCommand,
  } = useFlowWebSocket({
    autoConnect: true,
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    // Start the Python process when component mounts
    if (connected && status?.isRunning !== true) {
      startProcess()
        .then(() => {
          addSystemMessage('AI assistant is ready');
        })
        .catch((error) => {
          console.error('Failed to start process:', error);
          addSystemMessage('Failed to start AI assistant: ' + error.message);
        });
    }
  }, [connected, status]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function handleWebSocketMessage(message: FlowMessage) {
    // Handle agent output messages
    if (message.type === 'agent_output') {
      addAssistantMessage(message.payload?.content || 'No content');
      setIsProcessing(false);
    }
    
    // Handle log messages (optional)
    if (message.type === 'log' && message.payload?.level === 'info') {
      console.log('AI Log:', message.payload.message);
    }
    
    // Handle errors
    if (message.type === 'error') {
      addSystemMessage('Error: ' + message.payload?.message);
      setIsProcessing(false);
    }
    
    // Handle process exit
    if (message.type === 'process_exit') {
      addSystemMessage('AI assistant process exited');
      setIsProcessing(false);
    }
  }

  function addUserMessage(content: string) {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date(),
      status: 'sent'
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
  }

  function addAssistantMessage(content: string) {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: content,
      timestamp: new Date(),
      status: 'received'
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
  }

  function addSystemMessage(content: string) {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'system',
      content: content,
      timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!input.trim() || isProcessing) {
      return;
    }
    
    const userMessage = input.trim();
    setInput('');
    addUserMessage(userMessage);
    setIsProcessing(true);
    
    try {
      await sendCommand(userMessage);
      // The response will come through the WebSocket
    } catch (error) {
      console.error('Error sending message:', error);
      addSystemMessage('Failed to send message: ' + (error as Error).message);
      setIsProcessing(false);
    }
  }

  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="ai-chat-container">
      <div className="chat-header">
        <h2>AI Assistant</h2>
        <div className="connection-status">
          {connected ? (
            <span className="status-connected">Connected</span>
          ) : (
            <span className="status-disconnected">Disconnected</span>
          )}
          {status?.isRunning ? (
            <span className="status-running">Running</span>
          ) : (
            <span className="status-stopped">Stopped</span>
          )}
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-header">
              <span className="message-sender">
                {message.role === 'user' ? 'You' : 
                 message.role === 'assistant' ? 'AI Assistant' : 'System'}
              </span>
              <span className="message-time">{formatTimestamp(message.timestamp)}</span>
            </div>
            <div className="message-content">{message.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isProcessing || !connected || !status?.isRunning}
          className="chat-input"
        />
        <button 
          type="submit" 
          disabled={isProcessing || !connected || !status?.isRunning || !input.trim()} 
          className="send-button"
        >
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">
          Error: {error.message}
        </div>
      )}
    </div>
  );
};

export default AIChat; 