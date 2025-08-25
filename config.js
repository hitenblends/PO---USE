module.exports = {
  // Shopify Configuration
  shopify: {
    shopUrl: 'https://everythingsafetynd.myshopify.com',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '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',
    apiVersion: '2024-01'
  },
  
  // Credit Check API Configuration
  creditCheck: {
    apiUrl: process.env.CREDIT_CHECK_API_URL || 'http://54.148.31.213/api/creditCheck/'
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    corsOrigin: process.env.CORS_ORIGIN || 'https://everythingsafetynd.myshopify.com'
  }
};
