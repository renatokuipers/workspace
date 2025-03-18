// openmanus/client/src/api/browser.ts
import api from './api';

// Description: Create a new browser instance
// Endpoint: POST /api/browser
// Request: {}
// Response: { success: true, browserId: string }
export const createBrowser = async () => {
  try {
    const response = await api.post('/api/browser');
    return response.data;
  } catch (error) {
    console.error('Error creating browser:', error);
    throw new Error(error?.response?.data?.error || 'Failed to create browser instance');
  }
};

// Description: Navigate to a URL
// Endpoint: POST /api/browser/navigate
// Request: { browserId: string, url: string }
// Response: { success: true, url: string, title: string, screenshot: string, canGoBack: boolean, canGoForward: boolean }
export const navigateToUrl = async (browserId: string, url: string) => {
  try {
    const response = await api.post('/api/browser/navigate', { browserId, url });
    return response.data;
  } catch (error) {
    console.error('Error navigating to URL:', error);
    throw new Error(error?.response?.data?.error || 'Failed to navigate to URL');
  }
};

// Description: Go back in browser history
// Endpoint: POST /api/browser/back
// Request: { browserId: string }
// Response: { success: true, url: string, title: string, screenshot: string, canGoBack: boolean, canGoForward: boolean }
export const goBack = async (browserId: string) => {
  try {
    const response = await api.post('/api/browser/back', { browserId });
    return response.data;
  } catch (error) {
    console.error('Error going back:', error);
    throw new Error(error?.response?.data?.error || 'Failed to go back in history');
  }
};

// Description: Go forward in browser history
// Endpoint: POST /api/browser/forward
// Request: { browserId: string }
// Response: { success: true, url: string, title: string, screenshot: string, canGoBack: boolean, canGoForward: boolean }
export const goForward = async (browserId: string) => {
  try {
    const response = await api.post('/api/browser/forward', { browserId });
    return response.data;
  } catch (error) {
    console.error('Error going forward:', error);
    throw new Error(error?.response?.data?.error || 'Failed to go forward in history');
  }
};

// Description: Refresh the current page
// Endpoint: POST /api/browser/refresh
// Request: { browserId: string }
// Response: { success: true, url: string, title: string, screenshot: string, canGoBack: boolean, canGoForward: boolean }
export const refreshPage = async (browserId: string) => {
  try {
    const response = await api.post('/api/browser/refresh', { browserId });
    return response.data;
  } catch (error) {
    console.error('Error refreshing page:', error);
    throw new Error(error?.response?.data?.error || 'Failed to refresh page');
  }
};

// Description: Close a browser instance
// Endpoint: POST /api/browser/close
// Request: { browserId: string }
// Response: { success: true }
export const closeBrowser = async (browserId: string) => {
  try {
    const response = await api.post('/api/browser/close', { browserId });
    return response.data;
  } catch (error) {
    console.error('Error closing browser:', error);
    throw new Error(error?.response?.data?.error || 'Failed to close browser instance');
  }
};