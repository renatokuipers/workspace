// openmanus/client/src/api/api.ts
import axios from 'axios';

// Create an Axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle specific error codes
    if (error.response) {
      // Server responded with an error status
      const { status } = error.response;

      if (status === 401) {
        // Unauthorized - clear auth and redirect to login
        localStorage.removeItem('authToken');
        // If you have router available:
        // router.push('/login');
      }

      if (status === 503) {
        // Service unavailable - backend might be down
        console.error('Backend service is unavailable');
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network error - no response received');
    } else {
      // Something happened in setting up the request
      console.error('Error setting up request:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;