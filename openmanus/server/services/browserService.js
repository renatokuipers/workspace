const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

class BrowserService {
  constructor() {
    this.browsers = new Map();
    this.screenshotDir = path.join(os.tmpdir(), 'openmanus-screenshots');
    
    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async createBrowser(id) {
    try {
      // Check if browser already exists
      if (this.browsers.has(id)) {
        return { success: true, browserId: id };
      }

      console.log(`Creating new browser instance with ID: ${id}`);
      
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      // Enable request interception for more control
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        // Skip unnecessary resources to speed up browsing
        const resourceType = request.resourceType();
        if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font') {
          request.continue();
        } else {
          request.continue();
        }
      });
      
      this.browsers.set(id, { 
        browser, 
        page, 
        history: [], 
        currentIndex: -1,
        currentUrl: 'about:blank'
      });
      
      // Navigate to blank page initially
      await page.goto('about:blank');
      
      return { success: true, browserId: id };
    } catch (error) {
      console.error('Error creating browser:', error);
      return { success: false, error: error.message };
    }
  }

  async navigateTo(id, url) {
    try {
      // If browser doesn't exist, create it
      if (!this.browsers.has(id)) {
        const result = await this.createBrowser(id);
        if (!result.success) {
          throw new Error('Failed to create browser');
        }
      }

      const browserData = this.browsers.get(id);
      if (!browserData) {
        throw new Error('Browser not found');
      }

      // Validate and format URL
      let formattedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        if (url.includes('.') && !url.includes(' ')) {
          formattedUrl = `https://${url}`;
        } else {
          // Treat as search query
          formattedUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
      }

      console.log(`Navigating browser ${id} to: ${formattedUrl}`);
      
      // Update history
      if (browserData.currentUrl !== 'about:blank') {
        // Only update history if we're not on the blank page
        if (browserData.currentIndex < browserData.history.length - 1) {
          // Cut off forward history if navigating from a back state
          browserData.history = browserData.history.slice(0, browserData.currentIndex + 1);
        }
        browserData.history.push(formattedUrl);
        browserData.currentIndex = browserData.history.length - 1;
      } else {
        // First navigation from blank page
        browserData.history = [formattedUrl];
        browserData.currentIndex = 0;
      }
      
      // Update current URL
      browserData.currentUrl = formattedUrl;
      
      // Navigate the page
      await browserData.page.goto(formattedUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // Take screenshot
      const timestamp = Date.now();
      const screenshotPath = path.join(this.screenshotDir, `${id}_${timestamp}.png`);
      await browserData.page.screenshot({ path: screenshotPath });
      
      // Get page title
      const title = await browserData.page.title();
      
      // Get current URL (might have changed due to redirects)
      const finalUrl = browserData.page.url();
      if (finalUrl !== formattedUrl) {
        browserData.currentUrl = finalUrl;
        // Update the last history entry
        if (browserData.history.length > 0) {
          browserData.history[browserData.history.length - 1] = finalUrl;
        }
      }
      
      // Read screenshot as base64
      const screenshotBuffer = await fs.promises.readFile(screenshotPath);
      const screenshot = screenshotBuffer.toString('base64');
      
      return { 
        success: true, 
        url: finalUrl,
        title,
        screenshot,
        canGoBack: browserData.currentIndex > 0,
        canGoForward: browserData.currentIndex < browserData.history.length - 1
      };
    } catch (error) {
      console.error('Error navigating:', error);
      return { success: false, error: error.message };
    }
  }

  async goBack(id) {
    try {
      const browserData = this.browsers.get(id);
      if (!browserData) {
        throw new Error('Browser not found');
      }
      
      if (browserData.currentIndex <= 0) {
        return { success: false, error: 'Cannot go back - no history' };
      }
      
      // Go back in history
      browserData.currentIndex--;
      const url = browserData.history[browserData.currentIndex];
      
      // Navigate to the previous URL
      await browserData.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // Update current URL
      browserData.currentUrl = url;
      
      // Take screenshot
      const timestamp = Date.now();
      const screenshotPath = path.join(this.screenshotDir, `${id}_${timestamp}.png`);
      await browserData.page.screenshot({ path: screenshotPath });
      
      // Get page title
      const title = await browserData.page.title();
      
      // Read screenshot as base64
      const screenshotBuffer = await fs.promises.readFile(screenshotPath);
      const screenshot = screenshotBuffer.toString('base64');
      
      return { 
        success: true, 
        url,
        title,
        screenshot,
        canGoBack: browserData.currentIndex > 0,
        canGoForward: browserData.currentIndex < browserData.history.length - 1
      };
    } catch (error) {
      console.error('Error going back:', error);
      return { success: false, error: error.message };
    }
  }

  async goForward(id) {
    try {
      const browserData = this.browsers.get(id);
      if (!browserData) {
        throw new Error('Browser not found');
      }
      
      if (browserData.currentIndex >= browserData.history.length - 1) {
        return { success: false, error: 'Cannot go forward - no forward history' };
      }
      
      // Go forward in history
      browserData.currentIndex++;
      const url = browserData.history[browserData.currentIndex];
      
      // Navigate to the next URL
      await browserData.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // Update current URL
      browserData.currentUrl = url;
      
      // Take screenshot
      const timestamp = Date.now();
      const screenshotPath = path.join(this.screenshotDir, `${id}_${timestamp}.png`);
      await browserData.page.screenshot({ path: screenshotPath });
      
      // Get page title
      const title = await browserData.page.title();
      
      // Read screenshot as base64
      const screenshotBuffer = await fs.promises.readFile(screenshotPath);
      const screenshot = screenshotBuffer.toString('base64');
      
      return { 
        success: true, 
        url,
        title,
        screenshot,
        canGoBack: browserData.currentIndex > 0,
        canGoForward: browserData.currentIndex < browserData.history.length - 1
      };
    } catch (error) {
      console.error('Error going forward:', error);
      return { success: false, error: error.message };
    }
  }

  async refresh(id) {
    try {
      const browserData = this.browsers.get(id);
      if (!browserData) {
        throw new Error('Browser not found');
      }
      
      // Refresh the page
      await browserData.page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
      
      // Take screenshot
      const timestamp = Date.now();
      const screenshotPath = path.join(this.screenshotDir, `${id}_${timestamp}.png`);
      await browserData.page.screenshot({ path: screenshotPath });
      
      // Get page title
      const title = await browserData.page.title();
      
      // Get current URL
      const url = browserData.page.url();
      
      // Read screenshot as base64
      const screenshotBuffer = await fs.promises.readFile(screenshotPath);
      const screenshot = screenshotBuffer.toString('base64');
      
      return { 
        success: true, 
        url,
        title,
        screenshot,
        canGoBack: browserData.currentIndex > 0,
        canGoForward: browserData.currentIndex < browserData.history.length - 1
      };
    } catch (error) {
      console.error('Error refreshing:', error);
      return { success: false, error: error.message };
    }
  }

  async closeBrowser(id) {
    try {
      const browserData = this.browsers.get(id);
      if (browserData) {
        await browserData.browser.close();
        this.browsers.delete(id);
      }
      return { success: true };
    } catch (error) {
      console.error('Error closing browser:', error);
      return { success: false, error: error.message };
    }
  }

  // Add cleanup method for closing all browsers
  async cleanup() {
    for (const [id, browserData] of this.browsers.entries()) {
      try {
        await browserData.browser.close();
      } catch (error) {
        console.error(`Error closing browser ${id}:`, error);
      }
    }
    this.browsers.clear();
  }
}

module.exports = new BrowserService();