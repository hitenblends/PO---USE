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

    // Add metafield to existing Shopify customer to store the original customer ID
    // This will be used by the webhook to identify the correct customer for credit redemption
    try {
      await addMetafieldToExistingCustomer(shopify_customer_id, customer_id, creditData);
      console.log('✅ Customer metafield added successfully');
    } catch (metafieldError) {
      console.warn('⚠️ Warning: Could not add customer metafield:', metafieldError.message);
      // Continue with credit check even if metafield creation fails
    }

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

/**
 * Update existing customer metafield
 */
async function updateCustomerMetafield(shopifyCustomerId, originalCustomerId, creditData) {
  try {
    console.log('🔄 Updating existing metafield for customer:', shopifyCustomerId);
    
    // Get existing metafields to find the one we want to update
    const metafieldsResponse = await axios.get(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/customers/${shopifyCustomerId}/metafields.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken
        }
      }
    );
    
    // Find our metafield
    const existingMetafield = metafieldsResponse.data.metafields.find(meta => 
      meta.namespace === 'credit_system' && meta.key === 'original_customer_id'
    );
    
    if (existingMetafield) {
      // Update existing metafield
      const updateResponse = await axios.put(
        `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/metafields/${existingMetafield.id}.json`,
        {
          metafield: {
            value: originalCustomerId
          }
        },
        {
          headers: {
            'X-Shopify-Access-Token': config.shopify.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Metafield updated successfully:', updateResponse.data.metafield);
      return updateResponse.data.metafield;
    } else {
      throw new Error('Metafield not found for update');
    }
    
  } catch (error) {
    console.error('❌ Error updating metafield:', error.message);
    throw error;
  }
}

/**
 * Add metafield to an existing Shopify customer
 */
async function addMetafieldToExistingCustomer(shopifyCustomerId, originalCustomerId, creditData) {
  try {
    console.log('🔧 Adding metafield to existing Shopify customer:', shopifyCustomerId);

    // Create the metafield data
    const metafieldData = {
      metafield: {
        namespace: "credit_system",
        key: "original_customer_id",
        value: originalCustomerId,
        type: "single_line_text_field"
      }
    };

    // Add the metafield to the customer
    const metafieldResponse = await axios.post(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/customers/${shopifyCustomerId}/metafields.json`,
      metafieldData,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Metafield added successfully:', metafieldResponse.data.metafield);
    return metafieldResponse.data.metafield;

  } catch (error) {
    if (error.response?.status === 422) {
      // Metafield already exists, try to update it
      console.log('🔄 Metafield already exists, attempting to update...');
      return await updateCustomerMetafield(shopifyCustomerId, originalCustomerId, creditData);
    }
    throw error;
  }
}

module.exports = router;
