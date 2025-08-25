# Shopify Credit Check App

A Node.js application that integrates with your credit check API to provide dynamic discount creation for Shopify customers.

## Features

- **Credit Verification**: Integrates with external credit check API
- **Dynamic Discounts**: Automatically creates 100% discounts for eligible customers
- **Cart Integration**: Seamlessly integrates with Shopify cart page
- **Customer Authentication**: Only visible to logged-in customers
- **Responsive Design**: Mobile-friendly interface

## Architecture

```
├── server.js              # Main Express server
├── config.js              # Configuration settings
├── routes/
│   ├── creditCheck.js     # Credit check API routes
│   └── discounts.js       # Shopify discount management
├── Shopify theme files/
│   ├── snippets/
│   │   └── credit-check-form.liquid    # Cart integration snippet
│   └── sections/
│       └── main-cart.liquid            # Enhanced cart section
└── README.md              # This file
```

## API Endpoints

### Credit Check
- `POST /api/credit-check/verify` - Verify customer credits
- `GET /api/credit-check/status` - Check API health

### Discounts
- `POST /api/discounts/create` - Create dynamic discount
- `DELETE /api/discounts/:id` - Remove discount
- `GET /api/discounts/list/:customer_id` - List customer discounts

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd shopify-credit-check-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Update `config.js` with your Shopify store details
   - Set your credit check API URL
   - Configure CORS origin

4. **Start the application**
   ```bash
   npm start
   ```

## Shopify Theme Integration

### 1. Upload Snippet
Upload the `credit-check-form.liquid` snippet to your Shopify theme's `snippets` folder.

### 2. Include in Cart Template
Add this line to your cart template (usually `templates/cart.liquid`):
```liquid
{% render 'credit-check-form' %}
```

### 3. Update App URL
In the snippet, update the `APP_BASE_URL` variable to point to your deployed app.

## Configuration

### Shopify Settings
- **Shop URL**: Your Shopify store URL
- **Access Token**: Admin API access token
- **API Version**: Shopify API version (default: 2024-01)

### Credit Check API
- **Endpoint**: `http://54.148.31.213/api/creditCheck/`
- **Method**: POST
- **Body Format**:
  ```json
  {
    "customer_id": "lightspeed_original_uuid",
    "purchase_order": "valid_purchase_id"
  }
  ```

## Usage Flow

1. **Customer Login**: User must be logged in to see credit check option
2. **Enable Credit Check**: Customer checks the "I want to use my available credits" checkbox
3. **Enter Details**: Customer provides Customer ID and Purchase Order
4. **Verify Credits**: App calls external API to verify available credits
5. **Create Discount**: If credits are sufficient, creates 100% discount
6. **Apply Discount**: Automatically applies discount code to cart
7. **Checkout**: Customer can proceed with free checkout

## Security Features

- CORS protection with origin validation
- Input validation and sanitization
- Error handling and logging
- Rate limiting considerations
- Secure API communication

## Error Handling

The app includes comprehensive error handling for:
- API failures
- Invalid input data
- Shopify API errors
- Network timeouts
- Authentication issues

## Development

### Local Development
```bash
npm run dev
```

### Testing
```bash
# Test credit check endpoint
curl -X POST http://localhost:3000/api/credit-check/verify \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"test","purchase_order":"test"}'

# Test discount creation
curl -X POST http://localhost:3000/api/discounts/create \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"test","discount_amount":100,"cart_total":50}'
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions on Render.com.

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify CORS origin in config.js
   - Check if your domain is correctly configured

2. **Shopify API Errors**
   - Verify access token permissions
   - Check API version compatibility
   - Ensure store URL is correct

3. **Credit Check API Failures**
   - Verify API endpoint accessibility
   - Check network connectivity
   - Validate API response format

### Debug Mode
Enable detailed logging by setting `NODE_ENV=development` in your environment.

## Support

For technical support or questions:
- Check the logs for detailed error messages
- Verify all configuration settings
- Test API endpoints individually
- Review Shopify API documentation

## License

MIT License - see LICENSE file for details.
