// Define a simple browser-compatible EventEmitter implementation
class EventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  removeListener(event: string, listener: Function): this {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach(listener => listener(...args));
    return true;
  }
}

export interface FlowStatus {
  isRunning: boolean;
  processInfo?: any;
}

export interface FlowMessage {
  type: string;
  payload?: any;
  content?: string;
  timestamp?: string;
}

export interface CommandOptions {
  command: string;
  id?: string;
  timeout?: number;
}

class FlowWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number = 2000; // ms
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private autoReconnect: boolean = true;
  private pendingCommands: Map<string, { resolve: Function, reject: Function, timeout: NodeJS.Timeout }> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private baseUrl: string;

  constructor() {
    super();
    // Get the WebSocket URL from environment or construct it from window.location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;
    this.baseUrl = `${host}/ws/flow`;
  }

  // Connect to the WebSocket server
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  // Disconnect from the WebSocket server
  disconnect() {
    this.autoReconnect = false;
    this.clearReconnectTimer();

    if (this.ws) {
      // Cancel all pending commands with an error
      this.rejectAllPendingCommands('WebSocket disconnected');

      // Close the connection
      this.ws.close();
      this.ws = null;
    }
  }

  // Start the Python process
  async startProcess(initialPrompt?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ensureConnected()) {
        return reject(new Error('WebSocket not connected'));
      }

      const message: any = { type: 'start' };
      if (initialPrompt) {
        message.prompt = initialPrompt;
      }

      const messageId = 'start-' + Date.now();
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(messageId);
        reject(new Error('Timeout waiting for start response'));
      }, 30000);

      this.pendingCommands.set(messageId, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify(message));
    });
  }

  // Stop the Python process
  async stopProcess(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ensureConnected()) {
        return reject(new Error('WebSocket not connected'));
      }

      const messageId = 'stop-' + Date.now();
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(messageId);
        reject(new Error('Timeout waiting for stop response'));
      }, 10000);

      this.pendingCommands.set(messageId, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify({ type: 'stop' }));
    });
  }

  // Get the current status
  async getStatus(): Promise<FlowStatus> {
    return new Promise((resolve, reject) => {
      if (!this.ensureConnected()) {
        return reject(new Error('WebSocket not connected'));
      }

      const messageId = 'status-' + Date.now();
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(messageId);
        reject(new Error('Timeout waiting for status response'));
      }, 5000);

      this.pendingCommands.set(messageId, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify({ type: 'status' }));
    });
  }

  // Send a command to the Python process
  async sendCommand(options: CommandOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ensureConnected()) {
        return reject(new Error('WebSocket not connected'));
      }

      if (!options.command) {
        return reject(new Error('Command is required'));
      }

      const id = options.id || 'cmd-' + Date.now();
      const timeoutMs = options.timeout || 30000;

      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error('Timeout waiting for command response'));
      }, timeoutMs);

      this.pendingCommands.set(id, { resolve, reject, timeout });

      this.ws!.send(JSON.stringify({
        type: 'command',
        command: options.command,
        id
      }));
    });
  }

  // Check if WebSocket is connected
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  // Handle WebSocket open event
  private handleOpen(event: Event) {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');

    // Request initial status
    this.ws!.send(JSON.stringify({ type: 'status' }));
  }

  // Handle WebSocket message event
  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as FlowMessage;

      // Handle different message types
      switch (message.type) {
        case 'status':
          this.handleStatusMessage(message);
          break;

        case 'start_result':
          this.handleStartResult(message);
          break;

        case 'stop_result':
          this.handleStopResult(message);
          break;

        case 'command_result':
          this.handleCommandResult(message);
          break;

        case 'error':
          console.error('WebSocket error message:', message.payload || message.content);
          // Forward error to listeners with more details
          this.emit('error', {
            message: message.payload?.error || message.content || 'Unknown error occurred',
            details: message.payload || {},
            timestamp: message.timestamp
          });
          break;

        case 'process_exit':
          this.emit('process_exit', message.payload);
          break;

        case 'process_error':
          this.emit('process_error', message.payload);
          break;

        default:
          // Forward all other messages to listeners
          this.emit('message', message);
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }

  // Handle status message
  private handleStatusMessage(message: FlowMessage) {
    const status = message as unknown as FlowStatus;
    this.emit('status', status);

    // Resolve any pending status requests
    const pendingStatusCommands = Array.from(this.pendingCommands.entries())
      .filter(([key]) => key.startsWith('status-'));

    for (const [id, { resolve, timeout }] of pendingStatusCommands) {
      clearTimeout(timeout);
      resolve(status);
      this.pendingCommands.delete(id);
    }
  }

  // Handle start result
  private handleStartResult(message: FlowMessage) {
    const pendingStartCommands = Array.from(this.pendingCommands.entries())
      .filter(([key]) => key.startsWith('start-'));

    for (const [id, { resolve, reject, timeout }] of pendingStartCommands) {
      clearTimeout(timeout);

      if (message.payload?.success) {
        resolve(message.payload);
      } else {
        reject(new Error(message.payload?.error || 'Failed to start process'));
      }

      this.pendingCommands.delete(id);
    }
  }

  // Handle stop result
  private handleStopResult(message: FlowMessage) {
    const pendingStopCommands = Array.from(this.pendingCommands.entries())
      .filter(([key]) => key.startsWith('stop-'));

    for (const [id, { resolve, reject, timeout }] of pendingStopCommands) {
      clearTimeout(timeout);

      if (message.payload?.success) {
        resolve(message.payload);
      } else {
        reject(new Error(message.payload?.error || 'Failed to stop process'));
      }

      this.pendingCommands.delete(id);
    }
  }

  // Handle command result
  private handleCommandResult(message: FlowMessage) {
    const id = message.payload?.id;
    if (id && this.pendingCommands.has(id)) {
      const { resolve, reject, timeout } = this.pendingCommands.get(id)!;
      clearTimeout(timeout);

      if (message.payload?.success) {
        resolve(message.payload);
      } else {
        reject(new Error(message.payload?.error || 'Command failed'));
      }

      this.pendingCommands.delete(id);
    }
  }

  // Handle WebSocket close event
  private handleClose(event: CloseEvent) {
    console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    this.isConnected = false;
    this.ws = null;

    // Reject all pending commands
    this.rejectAllPendingCommands(`WebSocket closed: ${event.reason}`);

    // Emit disconnected event
    this.emit('disconnected', { code: event.code, reason: event.reason });

    // Schedule reconnect if enabled
    if (this.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  // Handle WebSocket error event
  private handleError(event: Event) {
    console.error('WebSocket error:', event);
    this.emit('error', { message: 'WebSocket connection error' });
  }

  // Schedule a reconnect attempt
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`Scheduling reconnection in ${this.reconnectTimeout}ms`);

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectTimeout);

      // Exponential backoff with max of 30 seconds
      this.reconnectTimeout = Math.min(this.reconnectTimeout * 1.5, 30000);
    } else {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('max_reconnect_attempts');
    }
  }

  // Clear the reconnect timer
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Ensure WebSocket is connected, return false if not
  private ensureConnected(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!this.isConnected) {
        // Try to connect if not already trying
        this.connect();
      }
      return false;
    }
    return true;
  }

  // Reject all pending commands with an error
  private rejectAllPendingCommands(reason: string) {
    for (const [id, { reject, timeout }] of this.pendingCommands.entries()) {
      clearTimeout(timeout);
      reject(new Error(reason));
      this.pendingCommands.delete(id);
    }
  }
}

// Export a singleton instance
export const flowWebSocket = new FlowWebSocketClient();
export default flowWebSocket;