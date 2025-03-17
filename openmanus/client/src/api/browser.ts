// openmanus/client/src/api/browser.ts
import api from './api';

// Description: Create a new browser instance
// Endpoint: POST /api/browser/create
// Request: {}
// Response: { success: boolean, browserId: string }
export const createBrowser = async () => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, browserId: 'mock-browser-id' });
    }, 500);
  });
};

// Description: Navigate to URL
// Endpoint: POST /api/browser/navigate
// Request: { browserId: string, url: string }
// Response: { success: boolean, screenshot: string }
export const navigateToUrl = async (url: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ 
        success: true, 
        screenshot: 'data:image/png;base64,mock-screenshot-data'
      });
    }, 500);
  });
};

// Description: Close browser instance
// Endpoint: POST /api/browser/close
// Request: { browserId: string }
// Response: { success: boolean }
export const closeBrowser = async (browserId: string) => {
  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 500);
  });
};