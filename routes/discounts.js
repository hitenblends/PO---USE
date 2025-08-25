const express = require('express');
const axios = require('axios');
const config = require('../config');
const router = express.Router();

/**
 * POST /api/discounts/create
 * Create a dynamic discount in Shopify
 */
router.post('/create', async (req, res) => {
  try {
    const { 
      customer_id, 
      discount_amount, 
      cart_total, 
      discount_code,
      expires_at 
    } = req.body;

    // Validate required fields
    if (!customer_id || !discount_amount || !cart_total) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'customer_id, discount_amount, and cart_total are required'
      });
    }

    // Validate discount amount
    const discountAmount = parseFloat(discount_amount);
    if (isNaN(discountAmount) || discountAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid discount amount',
        message: 'discount_amount must be a positive number'
      });
    }

    // Ensure discount amount doesn't exceed cart total
    const cartTotal = parseFloat(cart_total);
    if (discountAmount > cartTotal) {
      return res.status(400).json({
        error: 'Discount amount exceeds cart total',
        message: `Discount amount $${discountAmount} cannot exceed cart total $${cartTotal}`
      });
    }

    console.log('Creating discount with:', {
      customer_id,
      discount_amount: discountAmount,
      cart_total: cartTotal,
      discount_type: 'fixed_amount'
    });

    // Create discount code in Shopify
    const discountData = {
      price_rule: {
        title: `Credit Discount - ${customer_id} - $${discount_amount}`,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount", // Changed from percentage to fixed amount
        value: `-${discountAmount}`, // Fixed dollar amount discount
        customer_selection: "all", // Changed from "specific" to "all" to avoid customer ID issues
        starts_at: new Date().toISOString(),
        ends_at: expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default 24 hours
        usage_limit: 1,
        applies_once: true,
        minimum_requirement_type: "none", // No minimum requirement
        prerequisite_subtotal_range: null, // No prerequisite subtotal
        discount_codes: [
          {
            code: discount_code || `CREDIT_${customer_id}`,
            usage_count: 0
          }
        ]
      }
    };

    // Create the price rule (discount)
    const priceRuleResponse = await axios.post(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/price_rules.json`,
      discountData,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    const createdDiscount = priceRuleResponse.data.price_rule;
    
    console.log('Created discount:', createdDiscount);

    // Check if discount was created successfully
    if (!createdDiscount) {
      throw new Error('Failed to create discount in Shopify');
    }

    // Validate the created discount
    if (createdDiscount.value_type !== 'fixed_amount') {
      console.warn('Warning: Created discount value_type is not fixed_amount:', createdDiscount.value_type);
    }

    console.log('Discount created successfully:', {
      id: createdDiscount.id,
      title: createdDiscount.title,
      value_type: createdDiscount.value_type,
      value: createdDiscount.value,
      discount_codes: createdDiscount.discount_codes
    });

    // Generate a discount code if none was returned
    let discountCode = discount_code || `CREDIT_${customer_id}`;
    
    // If the discount was created but no code, we need to create the code separately
    if (!createdDiscount.discount_codes || createdDiscount.discount_codes.length === 0) {
      // Create the discount code separately
      const discountCodeData = {
        discount_code: {
          code: discountCode,
          price_rule_id: createdDiscount.id
        }
      };
      
      try {
        const codeResponse = await axios.post(
          `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/price_rules/${createdDiscount.id}/discount_codes.json`,
          discountCodeData,
          {
            headers: {
              'X-Shopify-Access-Token': config.shopify.accessToken,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('Created discount code:', codeResponse.data);
        discountCode = codeResponse.data.discount_code.code;
      } catch (codeError) {
        console.error('Failed to create discount code:', codeError.message);
        // Continue with the generated code even if creation fails
      }
    } else {
      discountCode = createdDiscount.discount_codes[0].code;
    }

    res.json({
      success: true,
      data: createdDiscount,
      message: `Discount created successfully for $${discountAmount} off $${cartTotal} cart total`,
      discount_code: discountCode,
      discount_amount: discountAmount,
      cart_total: cartTotal,
      remaining_amount: cartTotal - discountAmount
    });

  } catch (error) {
    console.error('Discount creation error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: 'Shopify API error',
        message: error.response.data?.errors || 'Failed to create discount',
        status: error.response.status
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

/**
 * DELETE /api/discounts/:id
 * Delete a discount from Shopify
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete the price rule (discount)
    await axios.delete(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/price_rules/${id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken
        }
      }
    );

    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });

  } catch (error) {
    console.error('Discount deletion error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: 'Shopify API error',
        message: error.response.data?.errors || 'Failed to delete discount',
        status: error.response.status
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

/**
 * GET /api/discounts/list
 * List all discounts for a customer
 */
router.get('/list/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;

    // Get all price rules
    const response = await axios.get(
      `https://${config.shopify.shopUrl.replace('https://', '')}/admin/api/${config.shopify.apiVersion}/price_rules.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken
        }
      }
    );

    // Filter discounts for the specific customer
    const customerDiscounts = response.data.price_rules.filter(rule => 
      rule.customer_ids && rule.customer_ids.includes(customer_id)
    );

    res.json({
      success: true,
      data: customerDiscounts,
      count: customerDiscounts.length
    });

  } catch (error) {
    console.error('Discount listing error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: 'Shopify API error',
        message: error.response.data?.errors || 'Failed to list discounts',
        status: error.response.status
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

module.exports = router;
