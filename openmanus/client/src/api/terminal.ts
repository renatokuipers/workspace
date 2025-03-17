// openmanus/client/src/api/terminal.ts
import api from './api';

// Description: Execute terminal command
// Endpoint: POST /api/terminal/execute
// Request: { command: string }
// Response: { output: string, error?: string, status: 'success' | 'error' }
export const executeCommand = async (command: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockResponses: { [key: string]: { output: string; error?: string; status: 'success' | 'error' } } = {
        'ls': {
          output: 'Documents/\nDownloads/\nPictures/\nMusic/\nVideos/',
          status: 'success'
        },
        'pwd': {
          output: '/home/user',
          status: 'success'
        },
        'date': {
          output: new Date().toString(),
          status: 'success'
        },
        'whoami': {
          output: 'user',
          status: 'success'
        },
        'echo': {
          output: command.slice(5),
          status: 'success'
        },
        'npm install': {
          output: '⠋ Installing dependencies...\n' +
                 'added 1234 packages in 2m 34s\n' +
                 '✓ Done\n',
          status: 'success'
        },
        'python': {
          error: 'Command not found: python',
          status: 'error'
        },
        'invalid_command': {
          error: 'Command not found: invalid_command',
          status: 'error'
        },
        'git push': {
          error: 'fatal: not a git repository (or any of the parent directories): .git',
          status: 'error'
        },
        'test': {
          output: 'Running tests...\n\n' +
                 '  Test 1: ✓ Passed\n' +
                 '  Test 2: ✓ Passed\n' +
                 '  Test 3: ✗ Failed\n\n' +
                 'Test Summary:\n' +
                 '  Total: 3\n' +
                 '  Passed: 2\n' +
                 '  Failed: 1\n',
          status: 'success'
        }
      };

      const cmdKey = Object.keys(mockResponses).find(key => command.startsWith(key)) || 'invalid_command';
      resolve(mockResponses[cmdKey]);
    }, 300);
  });
};