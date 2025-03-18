class WebSocketClient {
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageQueue: Array<{ id: string; content: string; sent: boolean }> = [];
  private eventListeners: { [key: string]: ((data: any) => void)[] } = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private messageBuffer: { id: string; content: string; sent: boolean }[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private sessionId: string | null = null;

  constructor(private path: string) {
    // Generate a unique session ID
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping connection');
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}${this.path}?sessionId=${this.sessionId}`;

    console.log(`Attempting to connect to WebSocket URL: ${wsUrl}`);

    try {
      this.socket = new WebSocket(wsUrl);

      console.log('WebSocket instance created');

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);

      console.log('WebSocket event handlers attached');
    } catch (error) {
      console.error('WebSocket connection error in constructor:', error);
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log('WebSocket connection established');
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Send any queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && !message.sent) {
        this.doSend(message.id, message.content);
        message.sent = true;
      }
    }

    // If reconnecting, request the current conversation state
    if (this.reconnectAttempts > 0) {
      this.send({
        type: 'status',
        requestConversationState: true,
        sessionId: this.sessionId
      });
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.type || 'message';

      if (this.eventListeners[eventType]) {
        this.eventListeners[eventType].forEach(listener => listener(data));
      }

      // Also trigger 'message' event for all messages
      if (eventType !== 'message' && this.eventListeners['message']) {
        this.eventListeners['message'].forEach(listener => listener(data));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    console.log('WebSocket readyState at close time:', this.socket?.readyState);
    console.log('Was connected before close:', this.isConnected);
    this.isConnected = false;
    this.socket = null;

    this.reconnectAttempts++;
    this.scheduleReconnect();
  }

  private handleError(event: Event) {
    console.error('WebSocket error with detailed event:', event);
    console.log('WebSocket readyState at error time:', this.socket?.readyState);
    this.isConnected = false;

    // Socket will close automatically after an error
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff up to 30s
      console.log(`Scheduling reconnection in ${delay}ms`);

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  send(message: string | object) {
    const messageId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const messageContent = typeof message === 'string' ? message : JSON.stringify(message);

    // Add session ID to object messages
    if (typeof message === 'object') {
      message = {
        ...message,
        sessionId: this.sessionId
      };
    }

    // Add to message buffer for potential reconnect
    this.messageBuffer.push({
      id: messageId,
      content: messageContent,
      sent: false
    });

    // Limit buffer size
    if (this.messageBuffer.length > 50) {
      this.messageBuffer.shift();
    }

    return this.doSend(messageId, message);
  }

  private doSend(messageId: string, message: string | object) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    if (!this.isConnected) {
      // Queue message to be sent when connection is established
      this.messageQueue.push({ id: messageId, content: messageStr, sent: false });
      return messageId;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(messageStr);

      // Mark as sent
      const bufferItem = this.messageBuffer.find(m => m.id === messageId);
      if (bufferItem) {
        bufferItem.sent = true;
      }
    }

    return messageId;
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  isReady() {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
  }
}

export default WebSocketClient;