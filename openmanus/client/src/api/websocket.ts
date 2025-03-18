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
  private pingTimer: NodeJS.Timeout | null = null;
  private lastPongTime: number = 0;

  constructor(private path: string) {
    // Generate a unique session ID
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping connection attempt');
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const wsUrl = `${this.path}?sessionId=${this.sessionId}`;

    console.log(`Connecting WebSocket to ${wsUrl}`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log('WebSocket connection established');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastPongTime = Date.now();

    // Set up ping to keep connection alive
    this.setupPing();

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

  private setupPing() {
    // Clear any existing ping timer
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    // Send ping every 20 seconds to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
        console.log('Sending ping to server');
        this.send({ type: 'ping', timestamp: Date.now() });

        // Check if we haven't received a pong in a while (45 seconds)
        const now = Date.now();
        if (now - this.lastPongTime > 45000) {
          console.warn('No pong received for 45 seconds, reconnecting...');
          this.reconnect();
        }
      } else {
        console.log('Cannot send ping, WebSocket is not connected');
      }
    }, 20000);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.type || 'message';

      console.log(`Received WebSocket message of type: ${eventType}`);

      // Update last pong time if we receive a pong
      if (eventType === 'pong') {
        this.lastPongTime = Date.now();
        console.log('Received pong from server');
      }

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
    this.isConnected = false;
    this.socket = null;

    // Clear ping timer
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    this.scheduleReconnect();
  }

  private handleError(event: Event) {
    console.error('WebSocket error:', event);
    this.isConnected = false;

    // Socket will close automatically after an error
  }

  private reconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.reconnectAttempts++;
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff up to 30s
      console.log(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.log(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached, giving up`);
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
      console.log('WebSocket not connected, queueing message');
      // Queue message to be sent when connection is established
      this.messageQueue.push({ id: messageId, content: messageStr, sent: false });
      return messageId;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log(`Sending WebSocket message: ${messageStr.substring(0, 50)}...`);
      try {
        this.socket.send(messageStr);

        // Mark as sent
        const bufferItem = this.messageBuffer.find(m => m.id === messageId);
        if (bufferItem) {
          bufferItem.sent = true;
        }
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        // If sending fails, try to reconnect
        this.reconnect();
      }
    } else {
      console.log(`WebSocket not ready, queueing message (readyState: ${this.socket?.readyState})`);
      this.messageQueue.push({ id: messageId, content: messageStr, sent: false });
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

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  isReady() {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
  }
}

export default WebSocketClient;