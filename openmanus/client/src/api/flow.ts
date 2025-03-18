import api from './api';

// Description: Start the Python process
// Endpoint: POST /api/start
// Request: { initialPrompt?: string }
// Response: { success: boolean, processId?: string, error?: string }
export const startPythonProcess = async (initialPrompt?: string) => {
  try {
    const response = await api.post('/api/start', { initialPrompt });
    return response.data;
  } catch (error) {
    console.error('Error starting Python process:', error);
    return { success: false, error: 'Failed to start Python process' };
  }
};

// Description: Stop the Python process
// Endpoint: POST /api/stop
// Request: {}
// Response: { success: boolean, error?: string }
export const stopPythonProcess = async () => {
  try {
    const response = await api.post('/api/stop');
    return response.data;
  } catch (error) {
    console.error('Error stopping Python process:', error);
    return { success: false, error: 'Failed to stop Python process' };
  }
};

// Description: Get process status
// Endpoint: GET /api/status
// Response: { isRunning: boolean, processInfo?: object }
export const getProcessStatus = async () => {
  try {
    const response = await api.get('/api/status');
    return response.data;
  } catch (error) {
    console.error('Error getting process status:', error);
    return { isRunning: false, error: 'Failed to get process status' };
  }
};

// Description: Execute a flow command
// Endpoint: POST /api/execute
// Request: { command: string }
// Response: { success: boolean, result?: any, error?: string }
export const executeFlowCommand = async (command: string) => {
  try {
    const response = await api.post('/api/execute', { command });
    return response.data;
  } catch (error) {
    console.error('Error executing flow command:', error);
    return { success: false, error: 'Failed to execute flow command' };
  }
};

// Description: Get process logs
// Endpoint: GET /api/logs
// Response: { success: boolean, logs?: Array<{ level: string, message: string, timestamp: string }>, error?: string }
export const getProcessLogs = async () => {
  try {
    const response = await api.get('/api/logs');
    return response.data;
  } catch (error) {
    console.error('Error getting process logs:', error);
    return { success: false, error: 'Failed to get process logs' };
  }
};

// Description: Health check to see if the backend is responsive
// Endpoint: GET /api/health
// Response: { status: 'up' | 'down', checks: object }
export const healthCheck = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('Error performing health check:', error);
    return { status: 'down', error: 'Failed to connect to backend' };
  }
}; 