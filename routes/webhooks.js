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
    
    // Ensure req.body is properly parsed as an object
    const orderData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    console.log('🎯 Topic from headers:', topic);
    console.log('🎯 Order data:', orderData.id, orderData.financial_status);

    if (topic === 'orders/paid') {
      console.log('💰 Order paid webhook - processing credit redemption...');
      await handleOrderPaid(orderData);
    } else if (topic === 'orders/create') {
      console.log('📦 Order created webhook - processing credit redemption for testing...');
      await handleOrderPaid(orderData); // Use same handler for testing
    } else {
      console.log('⚠️ Unknown webhook topic:', topic);
      console.log('📋 Full webhook payload:', orderData);
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

// Get original customer ID from discount code
async function getOriginalCustomerIdFromDiscount(discountCode) {
  try {
    console.log('🔍 Extracting original customer ID from discount code:', discountCode);
    
    // Extract original customer ID from discount code
    // Format: CREDIT_{original_customer_id}
    if (discountCode && discountCode.startsWith('CREDIT_')) {
      const originalCustomerId = discountCode.replace('CREDIT_', '');
      
      if (originalCustomerId) {
        console.log('✅ Found original customer ID from discount code:', originalCustomerId);
        return originalCustomerId;
      }
    }
    
    console.log('⚠️ Invalid discount code format:', discountCode);
    return null;

  } catch (error) {
    console.error('❌ Error extracting customer ID from discount code:', error.message);
    return null;
  }
}

module.exports = router;
