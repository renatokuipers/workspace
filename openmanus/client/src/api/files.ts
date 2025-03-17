import api from './api';
import { FileNode } from '@/types';

// Description: Get file tree structure
// Endpoint: GET /api/files/tree
// Request: {}
// Response: { files: FileNode[] }
export const getFileTree = async () => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        files: [
          {
            id: '1',
            name: 'workspace',
            type: 'directory',
            children: [
              {
                id: '2',
                name: 'projects',
                type: 'directory',
                children: [
                  {
                    id: '3',
                    name: 'example.py',
                    type: 'file',
                    content: 'print("Hello World")'
                  },
                  {
                    id: '4',
                    name: 'requirements.txt',
                    type: 'file',
                    content: 'requests==2.31.0\npython-dotenv==1.0.0'
                  }
                ]
              },
              {
                id: '5',
                name: 'data',
                type: 'directory',
                children: [
                  {
                    id: '6',
                    name: 'config.json',
                    type: 'file',
                    content: '{\n  "version": "1.0.0",\n  "environment": "development"\n}'
                  }
                ]
              }
            ]
          }
        ]
      });
    }, 500);
  });
};

// Description: Get file content
// Endpoint: GET /api/files/:id
// Request: {}
// Response: { content: string }
export const getFileContent = async (fileId: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        content: '// File content here\nconsole.log("Hello World!");'
      });
    }, 300);
  });
};

// Description: Save file content
// Endpoint: POST /api/files/:id
// Request: { content: string }
// Response: { success: boolean }
export const saveFileContent = async (fileId: string, content: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 300);
  });
};

// Description: Upload file
// Endpoint: POST /api/files/upload
// Request: FormData with file
// Response: { success: boolean, file: FileNode }
export const uploadFile = async (file: File) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        file: {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: 'file',
          content: 'Uploaded file content'
        }
      });
    }, 500);
  });
};