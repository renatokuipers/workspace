// openmanus/client/src/api/terminal.ts
import api from './api';
import WebSocketClient from './websocket';

let terminalWebSocket: WebSocketClient | null = null;
let terminalId: string | null = null;
let terminalListeners: Array<(data: any) => void> = [];

// Get or create terminal WebSocket connection
export const getTerminalWebSocket = (id?: string, cols?: number, rows?: number) => {
  if (!terminalWebSocket) {
    const params = new URLSearchParams();
    if (id) {
      terminalId = id;
      params.append('id', id);
    }
    if (cols) params.append('cols', cols.toString());
    if (rows) params.append('rows', rows.toString());

    const path = `/ws/terminal?${params.toString()}`;
    terminalWebSocket = new WebSocketClient(path);
    terminalWebSocket.connect();

    // Forward terminal messages to registered listeners
    terminalWebSocket.on('message', (data: any) => {
      terminalListeners.forEach(listener => listener(data));
    });
  }
  return terminalWebSocket;
};

// Description: Execute a command in the terminal
// Endpoint: WebSocket /ws/terminal
// Request: { type: 'input', data: string }
// Response: Terminal output via WebSocket
export const executeCommand = async (command: string) => {
  const ws = getTerminalWebSocket();

  // Return a promise that resolves immediately
  return new Promise<void>((resolve, reject) => {
    if (ws.isReady()) {
      ws.send({
        type: 'input',
        data: command
      });
      resolve();
    } else {
      reject(new Error('Terminal WebSocket not connected'));
    }
  });
};

// Resize the terminal
export const resizeTerminal = (cols: number, rows: number) => {
  const ws = getTerminalWebSocket();

  if (ws.isReady()) {
    ws.send({
      type: 'resize',
      cols,
      rows
    });
    return true;
  }
  return false;
};

// Register to receive terminal output
export const onTerminalData = (callback: (data: any) => void) => {
  terminalListeners.push(callback);
  return () => {
    terminalListeners = terminalListeners.filter(listener => listener !== callback);
  };
};

// Create a new terminal
export const createTerminal = async (cols: number = 80, rows: number = 24) => {
  try {
    // Use REST API to create a terminal
    const response = await api.post('/api/terminal', {
      cols,
      rows
    });

    const data = response.data;

    if (data.success) {
      // Connect to the terminal via WebSocket
      getTerminalWebSocket(data.terminalId, cols, rows);
      return { success: true, terminalId: data.terminalId };
    } else {
      throw new Error(data.error || 'Failed to create terminal');
    }
  } catch (error) {
    console.error('Error creating terminal:', error);
    throw new Error(error?.response?.data?.error || (error instanceof Error ? error.message : 'Failed to create terminal'));
  }
};

// Close the terminal
export const closeTerminal = async () => {
  try {
    if (terminalId) {
      // Use REST API to terminate the terminal
      const response = await api.post('/api/terminal/terminate', {
        terminalId
      });

      const data = response.data;

      // Disconnect WebSocket
      if (terminalWebSocket) {
        terminalWebSocket.disconnect();
        terminalWebSocket = null;
      }

      terminalId = null;
      return data.success;
    }
    return false;
  } catch (error) {
    console.error('Error closing terminal:', error);
    return false;
  }
};