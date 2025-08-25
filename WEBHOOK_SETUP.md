# 🎯 Shopify Webhook Setup for Credit Redemption

## 📋 Overview

This system now uses Shopify webhooks to automatically trigger credit redemption when orders are paid, providing a much more reliable and professional approach than frontend page detection.

## 🚀 Webhook Endpoints

### **Backend Webhook URL:**
```
https://shopify-credit-check-app.onrender.com/api/webhooks/shopify/orders
```

### **Supported Webhook Topics:**

1. **`orders/paid`** - **Primary trigger for credit redemption**
   - Fires when payment is captured
   - Processes credit redemption automatically
   - Most reliable for ensuring payment confirmation

2. **`orders/create`** - **Monitoring only**
   - Fires when order is created (may be unpaid)
   - Logs order creation for reference
   - Does not trigger credit redemption

## 🔧 Shopify Admin Setup

### **Step 1: Access Webhook Settings**
1. Go to your Shopify Admin Panel
2. Navigate to **Settings** → **Notifications**
3. Scroll down to **Webhooks** section
4. Click **Create webhook**

### **Step 2: Configure Webhooks**

#### **Webhook 1: Orders Paid**
- **Event**: `Order payment`
- **Format**: `JSON`
- **URL**: `https://shopify-credit-check-app.onrender.com/api/webhooks/shopify/orders`
- **Version**: `2024-01` (or latest)

#### **Webhook 2: Orders Created**
- **Event**: `Order creation`
- **Format**: `JSON`
- **URL**: `https://shopify-credit-check-app.onrender.com/api/webhooks/shopify/orders`
- **Version**: `2024-01` (or latest)

### **Step 3: Test Webhooks**
1. Create a test order with credits
2. Complete the checkout process
3. Check your backend logs for webhook events
4. Verify credit redemption API calls

## 📊 Webhook Data Structure

### **Orders/Paid Webhook Payload:**
```json
{
  "topic": "orders/paid",
  "data": {
    "id": 123456789,
    "order_number": "#1001",
    "customer": {
      "id": 987654321,
      "email": "customer@example.com"
    },
    "total_price": "95.88",
    "total_discounts": "40.00",
    "discount_codes": [
      {
        "code": "CREDIT_1234567890",
        "amount": "40.00"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "financial_status": "paid"
  }
}
```

## 🔄 Credit Redemption Flow

### **Complete Process:**
1. **User applies credits** → Discount created in Shopify
2. **User completes checkout** → Order created
3. **Payment captured** → `orders/paid` webhook fires
4. **Backend processes webhook** → Extracts order data
5. **Credit redemption API called** → External system updated
6. **Success logged** → Transaction complete

### **Data Sent to Redemption API:**
```json
{
  "customer_id": "987654321",
  "amount": -40.00,
  "user_id": "987654321",
  "client_id": "123456789"
}
```

## 🛠️ Backend Implementation

### **Webhook Handler:**
- **Route**: `/api/webhooks/shopify/orders`
- **Method**: `POST`
- **Authentication**: None (Shopify webhooks are public)
- **Processing**: Automatic credit redemption for paid orders

### **Key Functions:**
- `handleOrderPaid()` - Processes paid orders
- `callCreditRedemptionAPI()` - Calls external redemption API
- **Error Handling**: Comprehensive logging and error management

## 🔍 Monitoring & Debugging

### **Backend Logs:**
```bash
🎯 Shopify webhook received: orders/paid
💰 Order paid webhook - processing credit redemption...
🎯 Processing paid order: 123456789
🎯 Credit discount found: CREDIT_1234567890
🎯 Calling credit redemption API with: {...}
✅ Credit redemption successful for order: 123456789
```

### **Webhook Status:**
- Check Shopify Admin → Settings → Notifications → Webhooks
- Monitor delivery status and retry attempts
- Verify webhook URLs are accessible

## 🚨 Troubleshooting

### **Common Issues:**

1. **Webhook Not Firing:**
   - Verify webhook URL is accessible
   - Check webhook is enabled in Shopify
   - Ensure correct event type selected

2. **Credit Redemption Fails:**
   - Check backend logs for API errors
   - Verify external API endpoint is accessible
   - Check discount code format matches expected pattern

3. **Order Data Missing:**
   - Ensure webhook version is current
   - Verify order has discount codes
   - Check customer ID extraction

### **Testing:**
1. **Create test order** with small credit amount
2. **Monitor backend logs** during checkout
3. **Verify webhook delivery** in Shopify Admin
4. **Check redemption API** for successful calls

## 📈 Benefits of Webhook Approach

### **✅ Advantages:**
- **🎯 Guaranteed Triggers**: Fires exactly when events happen
- **💰 Payment Confirmation**: Only acts on confirmed payments
- **📊 Complete Data**: Full order details available
- **🔄 Real-time**: Immediate processing
- **🏗️ Professional**: Industry-standard architecture
- **🛡️ Reliable**: No dependency on page navigation

### **🔄 vs. Frontend Detection:**
- **More reliable** than page detection
- **Real-time processing** vs. delayed detection
- **Complete order data** vs. limited frontend data
- **Professional architecture** vs. workaround solution

## 🔐 Security Considerations

### **Webhook Security:**
- **Public endpoint** - no authentication required
- **Shopify verification** - webhooks come from Shopify servers
- **Data validation** - all incoming data is validated
- **Error handling** - graceful failure handling

### **API Security:**
- **HTTPS only** - secure communication
- **Timeout handling** - prevents hanging requests
- **Error logging** - comprehensive error tracking

---

## 🎯 Next Steps

1. **Set up webhooks** in Shopify Admin
2. **Test with small orders** to verify functionality
3. **Monitor backend logs** for webhook processing
4. **Verify credit redemption** in external system
5. **Scale up** to production orders

Your credit redemption system is now fully automated and professional! 🚀✨
