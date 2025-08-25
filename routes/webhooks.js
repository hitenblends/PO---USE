const express = require('express');
const router = express.Router();
const axios = require('axios');

// Webhook endpoint for Shopify order events
router.post('/shopify/orders', async (req, res) => {
  try {
    console.log('🎯 Shopify webhook received - Raw data:', JSON.stringify(req.body, null, 2));
    console.log('🎯 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🎯 Topic:', req.body.topic);
    console.log('🎯 Data:', req.body.data);

    const { topic, data } = req.body;

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

    // Get customer ID from order
    const customerId = orderData.customer?.id;
    if (!customerId) {
      console.log('⚠️ No customer ID found in order');
      return;
    }

    // Prepare redemption data
    const redemptionData = {
      customer_id: customerId.toString(),
      amount: -discountAmount, // Negative value for credit reduction
      user_id: customerId.toString(), // Same as customer_id
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

module.exports = router;
