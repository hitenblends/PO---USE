const express = require('express');
const axios = require('axios');
const config = require('../config');
const router = express.Router();

/**
 * POST /api/credit-check/verify
 * Verify customer credits using the external API
 */
router.post('/verify', async (req, res) => {
  try {
    const { customer_id, purchase_order, shopify_customer_id } = req.body;

    // Validate required fields
    if (!customer_id || !purchase_order || !shopify_customer_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'customer_id, purchase_order, and shopify_customer_id are required'
      });
    }

    // Call the external credit check API
    const response = await axios.post(config.creditCheck.apiUrl, {
      customer_id,
      purchase_order
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    const creditData = response.data;
    
    console.log('Credit check response:', creditData);

    res.json({
      success: true,
      data: creditData,
      message: 'Credit check completed successfully'
    });

  } catch (error) {
    console.error('Credit check error:', error.message);
    
    if (error.response) {
      // API responded with error status
      res.status(error.response.status).json({
        error: 'Credit check API error',
        message: error.response.data?.message || 'External API error',
        status: error.response.status
      });
    } else if (error.request) {
      // Request was made but no response received
      res.status(503).json({
        error: 'Credit check service unavailable',
        message: 'Unable to reach credit check service'
      });
    } else {
      // Other error
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

/**
 * GET /api/credit-check/status
 * Get the status of the credit check service
 */
router.get('/status', async (req, res) => {
  try {
    // Simple health check to the external API
    const response = await axios.get(config.creditCheck.apiUrl.replace('/api/creditCheck/', ''), {
      timeout: 5000
    });
    
    res.json({
      success: true,
      status: 'connected',
      message: 'Credit check service is available'
    });
  } catch (error) {
    res.json({
      success: false,
      status: 'disconnected',
      message: 'Credit check service is unavailable'
    });
  }
});

module.exports = router;
