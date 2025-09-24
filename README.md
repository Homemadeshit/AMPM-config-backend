# INOX Table Configurator - Backend

Express.js API for INOX table pricing calculations and inquiry management.

## 🚀 Features

- **Price Calculator**: Real-time pricing with startup discounts
- **Email System**: Automated inquiry notifications
- **TypeScript**: Type-safe API development
- **Configuration**: JSON-based pricing rules

## 🛠 Tech Stack

- **Node.js** with Express
- **TypeScript** for type safety
- **Nodemon** for development
- **Email Integration**

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

API will be available at [http://localhost:4000](http://localhost:4000)

## 📦 Build & Deploy

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## 🌐 Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)

## 📁 Project Structure

```
src/
├── index.ts          # Main server
├── app.ts           # Express app setup
├── price.ts         # Pricing logic
├── email.ts         # Email functionality
└── config.ts        # Configuration
config/
└── pricing.v1.json  # Pricing rules
```

## 🎯 API Endpoints

### POST /api/price
Calculate table price based on configuration.

**Request Body:**
```json
{
  "product_type": "dimensioned",
  "dimension": "200x100", 
  "delivery_days": 60,
  "advance_payment": "50",
  "quantity": 1
}
```

**Response:**
```json
{
  "total": 1070,
  "regular": 1170,
  "discount": 100,
  "discountPercentage": 8.5
}
```

### POST /api/inquiry
Submit customer inquiry with email notification.

## ⚙️ Environment Variables

```bash
# Email configuration (optional)
SMTP_HOST=your-smtp-host
SMTP_USER=your-email
SMTP_PASS=your-password

# Server port
PORT=4000
```

## 🎯 Pricing Logic

- **Base prices**: Configured in `config/pricing.v1.json`
- **Startup discounts**: Automatic percentage discounts
- **Quantity pricing**: Bulk pricing support
- **Delivery options**: 30, 45, 60 days

Built with ❤️ for AM & PM GLOBAL INTERNATIONAL
