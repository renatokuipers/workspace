const puppeteer = require('puppeteer');

class BrowserService {
  constructor() {
    this.browsers = new Map();
  }

  async createBrowser(id) {
    try {
      // Check if browser already exists
      if (this.browsers.has(id)) {
        return { success: true };
      }

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      this.browsers.set(id, { browser, page });
      return { success: true };
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

      await browserData.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      const screenshot = await browserData.page.screenshot({
        encoding: 'base64',
        fullPage: false
      });
      
      return { success: true, screenshot };
    } catch (error) {
      console.error('Error navigating:', error);
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