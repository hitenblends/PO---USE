const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config'); // Added missing import for config

// Webhook endpoint for Shopify order events
router.post('/shopify/orders', async (req, res) => {
  try {
    console.log('🎯 Shopify webhook received - Raw data:', JSON.stringify(req.body, null, 2));
    console.log('🎯 Headers:', JSON.stringify(req.headers, null, 2));
    
    // Read topic from Shopify headers (not request body)
    const topic = req.headers['x-shopify-topic'];
    const data = req.body; // Order data is in the body
    
    console.log('🎯 Topic from headers:', topic);
    console.log('🎯 Order data:', data.id, data.financial_status);

    if (topic === 'orders/paid') {
      console.log('💰 Order paid webhook - processing credit redemption...');
      await handleOrderPaid(data);
    } else if (topic === 'orders/create') {
      console.log('📦 Order created webhook - processing credit redemption for testing...');
      await handleOrderPaid(data); // Use same handler for testing
    } else {
      console.log('⚠️ Unknown webhook topic:', topic);
      console.log('📋 Full webhook payload:', req.body);
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle paid orders - trigger credit redemption
async function handleOrderPaid(orderData) {
  try {
    console.log('🎯 Processing order:', orderData.id);
    console.log('💰 Financial status:', orderData.financial_status);
    console.log('📊 Total price:', orderData.total_price);
    console.log('🎫 Discount codes:', orderData.discount_codes?.length || 0);
    
    // Check if this order used credits (has discount codes)
    if (!orderData.discount_codes || orderData.discount_codes.length === 0) {
      console.log('ℹ️ No discount codes found - order did not use credits');
      return;
    }

    // Find credit discount code
    const creditDiscount = orderData.discount_codes.find(discount => 
      discount.code && discount.code.startsWith('CREDIT_')
    );

    if (!creditDiscount) {
      console.log('ℹ️ No credit discount code found');
      return;
    }

    console.log('🎯 Credit discount found:', creditDiscount.code);

    // Extract discount amount
    const discountAmount = parseFloat(creditDiscount.amount || 0);
    if (discountAmount <= 0) {
      console.log('⚠️ Invalid discount amount:', discountAmount);
      return;
    }

    // Get the original customer ID from discount properties
    const originalCustomerId = await getOriginalCustomerIdFromDiscount(creditDiscount.code);
    
    if (!originalCustomerId) {
      console.log('⚠️ Could not find original customer ID in discount properties');
      return;
    }

    console.log('🎯 Using original customer ID for credit redemption:', originalCustomerId);

    // Prepare redemption data
    const redemptionData = {
      customer_id: originalCustomerId,
      amount: -discountAmount, // Negative value for credit reduction
      user_id: originalCustomerId, // Same as customer_id
      client_id: orderData.id.toString() // Shopify order ID
    };

    console.log('🎯 Calling credit redemption API with:', redemptionData);

    // Call credit redemption API
    const redemptionResult = await callCreditRedemptionAPI(redemptionData);

    if (redemptionResult.success) {
      console.log('✅ Credit redemption successful for order:', orderData.id);
    } else {
      console.error('❌ Credit redemption failed for order:', orderData.id, redemptionResult);
      
      // TODO: Implement rollback mechanism if needed
      // This could involve removing the Shopify discount
    }

  } catch (error) {
    console.error('❌ Error processing order webhook:', error);
  }
}

// Credit Redemption API call
async function callCreditRedemptionAPI(data) {
  try {
    console.log('🎯 Calling credit redemption API with data:', data);
    
    const response = await axios.post('http://54.148.31.213/api/creditRedemption/', data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // 10 second timeout
    });
    
    const result = response.data;
    console.log('🎯 Credit redemption API response:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Credit redemption API error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Get original customer ID from discount code properties
async function getOriginalCustomerIdFromDiscount(discountCode) {
  try {
    console.log('🔍 Fetching discount code details for:', discountCode);
    
    // First, find the price rule that contains this discount code
    const priceRulesResponse = await axios.get(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/price_rules.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken
        }
      }
    );

    // Find the price rule that contains our discount code
    const priceRule = priceRulesResponse.data.price_rules.find(rule => 
      rule.discount_codes && rule.discount_codes.some(code => code.code === discountCode)
    );

    if (!priceRule) {
      console.log('⚠️ No price rule found for discount code:', discountCode);
      return null;
    }

    console.log('🎯 Found price rule:', priceRule.id);

    // Get the specific discount code details
    const discountCodeResponse = await axios.get(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/price_rules/${priceRule.id}/discount_codes.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken
        }
      }
    );

    // Find our specific discount code
    const discountCodeDetails = discountCodeResponse.data.discount_codes.find(code => code.code === discountCode);

    if (!discountCodeDetails) {
      console.log('⚠️ No discount code details found for:', discountCode);
      return null;
    }

    console.log('🎯 Found discount code details:', discountCodeDetails);

    // Extract original customer ID from properties
    if (discountCodeDetails.properties) {
      const originalCustomerIdProperty = discountCodeDetails.properties.find(prop => 
        prop.name === 'original_customer_id'
      );

      if (originalCustomerIdProperty) {
        console.log('✅ Found original customer ID in properties:', originalCustomerIdProperty.value);
        return originalCustomerIdProperty.value;
      }
    }

    console.log('⚠️ No original customer ID property found in discount code');
    return null;

  } catch (error) {
    console.error('❌ Error fetching discount code details:', error.message);
    return null;
  }
}

module.exports = router;
