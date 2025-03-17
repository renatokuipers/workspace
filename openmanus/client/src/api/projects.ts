import api from './api';

// Description: Get all projects
// Endpoint: GET /api/projects
// Request: {}
// Response: { projects: Array<{ id: string, name: string, createdAt: string, lastUpdated: string }> }
export const getProjects = () => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        projects: [
          { id: '1', name: 'Website Redesign', createdAt: '2024-03-15T10:00:00Z', lastUpdated: '2024-03-15T15:30:00Z' },
          { id: '2', name: 'API Integration', createdAt: '2024-03-14T09:00:00Z', lastUpdated: '2024-03-14T16:45:00Z' },
          { id: '3', name: 'Bug Fixes', createdAt: '2024-03-13T14:20:00Z', lastUpdated: '2024-03-13T18:15:00Z' },
        ]
      });
    }, 500);
  });
};

// Description: Create a new project
// Endpoint: POST /api/projects
// Request: { name: string }
// Response: { project: { id: string, name: string, createdAt: string, lastUpdated: string } }
export const createProject = (name: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        project: {
          id: Math.random().toString(36).substr(2, 9),
          name,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
      });
    }, 500);
  });
};

// Description: Get project chat history
// Endpoint: GET /api/projects/:id/chat
// Request: {}
// Response: { messages: ChatMessage[] }
export const getProjectChat = (projectId: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        messages: [
          {
            id: '1',
            content: `Welcome to project ${projectId}! I'm Manus, your AI assistant. How can I help you today?`,
            role: 'assistant',
            timestamp: new Date().toISOString()
          }
        ]
      });
    }, 500);
  });
};

// Description: Delete a project
// Endpoint: DELETE /api/projects/:id
// Request: {}
// Response: { success: boolean }
export const deleteProject = (projectId: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 500);
  });
};