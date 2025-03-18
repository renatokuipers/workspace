const express = require('express');
const router = express.Router();
const browserService = require('../services/browserService');

router.post('/create', async (req, res) => {
  try {
    const browserId = Math.random().toString(36).substring(2);
    const result = await browserService.createBrowser(browserId);
    if (result.success) {
      res.json({ success: true, browserId });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/navigate', async (req, res) => {
  try {
    const { browserId, url } = req.body;
    const result = await browserService.navigateTo(browserId, url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/close', async (req, res) => {
  try {
    const { browserId } = req.body;
    const result = await browserService.closeBrowser(browserId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;