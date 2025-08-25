module.exports = {
  // Shopify Configuration
  shopify: {
    shopUrl: 'https://everythingsafetynd.myshopify.com',
    accessToken: 'YOUR_SHOPIFY_ACCESS_TOKEN_HERE',
    apiVersion: '2024-01'
  },
  
  // Credit Check API Configuration
  creditCheck: {
    apiUrl: 'http://54.148.31.213/api/creditCheck/'
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    corsOrigin: 'https://everythingsafetynd.myshopify.com'
  }
};
