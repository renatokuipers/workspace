// openmanus/client/src/api/tools.ts
import api from './api';
import { Tool } from '@/types';

// Description: Get available tools
// Endpoint: GET /api/tools
// Request: {}
// Response: { tools: Tool[] }
export const getTools = async () => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        tools: [
          { id: '1', name: 'Code Editor', type: 'code' },
          { id: '2', name: 'Terminal', type: 'terminal' },
          { id: '3', name: 'Browser', type: 'browser' }
        ]
      });
    }, 500);
  });
};

// Description: Execute tool action
// Endpoint: POST /api/tools/execute
// Request: { toolId: string, action: string, data: any }
// Response: { success: boolean, result: any }
export const executeToolAction = async (toolId: string, action: string, data: any) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        result: { output: 'Command executed successfully' }
      });
    }, 1000);
  });
};