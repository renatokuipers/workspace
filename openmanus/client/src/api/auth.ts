// openmanus/client/src/api/auth.ts
import api from './api';

// Description: Login user
// Endpoint: POST /api/auth/login
// Request: { email: string, password: string }
// Response: { user: { id: string, email: string }, token: string }
export const login = async (email: string, password: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        user: { id: '1', email },
        token: 'mock-jwt-token'
      });
    }, 500);
  });
};

// Description: Register user
// Endpoint: POST /api/auth/register
// Request: { email: string, password: string }
// Response: { user: { id: string, email: string }, token: string }
export const register = async (email: string, password: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        user: { id: '1', email },
        token: 'mock-jwt-token'
      });
    }, 500);
  });
};