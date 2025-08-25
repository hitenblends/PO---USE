const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const config = require('./config');
const creditCheckRoutes = require('./routes/creditCheck');
const discountRoutes = require('./routes/discounts');
const webhookRoutes = require('./routes/webhooks');

const app = express();

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/credit-check', creditCheckRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Credit Check App is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`🚀 Credit Check App server running on port ${PORT}`);
  console.log(`📱 Shopify Shop: ${config.shopify.shopUrl}`);
  console.log(`🔗 Credit Check API: ${config.creditCheck.apiUrl}`);
});

module.exports = app;
