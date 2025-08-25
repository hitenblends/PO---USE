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
    const { customer_id, purchase_order } = req.body;

    // Validate required fields
    if (!customer_id || !purchase_order) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'customer_id and purchase_order are required'
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

    // Create customer metafield to store the original customer ID
    // This will be used by the webhook to identify the correct customer for credit redemption
    try {
      await createCustomerMetafield(customer_id, creditData);
      console.log('✅ Customer metafield created/updated successfully');
    } catch (metafieldError) {
      console.warn('⚠️ Warning: Could not create customer metafield:', metafieldError.message);
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
 * Create or update customer metafield to store original customer ID
 * This metafield will be used by webhooks to identify the correct customer for credit redemption
 */
async function createCustomerMetafield(originalCustomerId, creditData) {
  try {
    console.log('🔧 Creating/updating customer metafield for:', originalCustomerId);
    
    // First, try to find an existing customer by email or create a new one
    // We'll use a placeholder email since we need a customer record to store metafields
    const customerEmail = `customer_${originalCustomerId}@creditsystem.local`;
    
    // Check if customer exists
    let customer = await findOrCreateCustomer(customerEmail, originalCustomerId);
    
    if (!customer) {
      throw new Error('Could not find or create customer record');
    }
    
    console.log('🎯 Customer record found/created:', customer.id);
    
    // Create or update the metafield
    const metafieldData = {
      metafield: {
        namespace: "credit_system",
        key: "original_customer_id",
        value: originalCustomerId,
        type: "single_line_text_field"
      }
    };
    
    // Try to create the metafield
    const metafieldResponse = await axios.post(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/customers/${customer.id}/metafields.json`,
      metafieldData,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Metafield created successfully:', metafieldResponse.data.metafield);
    return metafieldResponse.data.metafield;
    
  } catch (error) {
    if (error.response?.status === 422) {
      // Metafield already exists, try to update it
      console.log('🔄 Metafield already exists, attempting to update...');
      return await updateCustomerMetafield(originalCustomerId, creditData);
    }
    throw error;
  }
}

/**
 * Update existing customer metafield
 */
async function updateCustomerMetafield(originalCustomerId, creditData) {
  try {
    const customerEmail = `customer_${originalCustomerId}@creditsystem.local`;
    const customer = await findOrCreateCustomer(customerEmail, originalCustomerId);
    
    if (!customer) {
      throw new Error('Could not find customer record for metafield update');
    }
    
    // Get existing metafields to find the one we want to update
    const metafieldsResponse = await axios.get(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/customers/${customer.id}/metafields.json`,
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
 * Find existing customer by email or create new one
 */
async function findOrCreateCustomer(email, originalCustomerId) {
  try {
    // First, try to find existing customer
    const searchResponse = await axios.get(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/customers/search.json?query=email:${email}`,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken
        }
      }
    );
    
    if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
      console.log('👤 Found existing customer:', searchResponse.data.customers[0].id);
      return searchResponse.data.customers[0];
    }
    
    // Create new customer if not found
    console.log('👤 Creating new customer for:', originalCustomerId);
    const createResponse = await axios.post(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/customers.json`,
      {
        customer: {
          email: email,
          first_name: `Customer`,
          last_name: originalCustomerId.substring(0, 8),
          note: `Credit system customer - Original ID: ${originalCustomerId}`,
          tags: 'credit_system,external_customer'
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ New customer created:', createResponse.data.customer.id);
    return createResponse.data.customer;
    
  } catch (error) {
    console.error('❌ Error finding/creating customer:', error.message);
    throw error;
  }
}

module.exports = router;
