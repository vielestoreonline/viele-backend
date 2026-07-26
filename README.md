# Viele Backend - Stripe Payment Server

This is the backend server for Viele marketplace. It handles:
- Creating payment intents (buyers pay)
- Processing payouts to sellers (escrow release)
- Stripe webhook handling
- Platform balance tracking

## Setup

### 1. Install Dependencies

```bash
cd viele-backend
npm install
```

### 2. Set Up Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Fill in your values:

```env
# Stripe Keys (from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Your frontend URL
FRONTEND_URL=https://www.viele.store
```

**Get Stripe keys:**
1. Go to https://stripe.com
2. Sign up / Log in
3. Switch to **TEST MODE** (toggle top right)
4. Go to Developers → API Keys
5. Copy Secret key (sk_test_...)

### 3. Run Locally

```bash
npm start
```

Server runs on http://localhost:3000

### 4. Test the API

```bash
# Health check
curl http://localhost:3000/

# Create a payment intent
curl -X POST http://localhost:3000/api/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 50.00, "currency": "gbp", "buyerEmail": "test@example.com"}'
```

## Deploy to Railway

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. No credit card needed for free tier

### Step 2: Create New Project
1. Click "New Project"
2. Choose "Deploy from GitHub repo"
3. Select your repository (or upload the folder)

### Step 3: Add Environment Variables
1. Click your project
2. Go to "Variables" tab
3. Add each variable from your `.env` file:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (optional for dev)
   - `FRONTEND_URL`

### Step 4: Deploy
Railway auto-deploys when you push to GitHub.

Or deploy manually:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Step 5: Get Your API URL
1. In Railway dashboard, click your project
2. Go to "Settings"
3. Copy the "Domain" (e.g., `https://viele-api.up.railway.app`)

### Step 6: Connect Frontend
Add the Railway URL to your frontend `.env`:
```env
VITE_API_URL=https://viele-api.up.railway.app
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/create-payment-intent` | POST | Create a payment (buyer pays) |
| `/api/confirm-payment` | POST | Confirm payment succeeded |
| `/api/create-seller-account` | POST | Create seller Stripe Connect account |
| `/api/payout-seller` | POST | Release funds to seller |
| `/api/payout/:transferId` | GET | Check payout status |
| `/api/balance` | GET | View platform balance |
| `/api/transactions` | GET | View transactions |
| `/api/webhook` | POST | Stripe webhook endpoint |

## How Payments Work

```
1. Buyer clicks "Pay" on checkout
   → Frontend calls POST /api/create-payment-intent
   → Backend creates Stripe PaymentIntent
   → Returns client_secret to frontend

2. Buyer enters card details & confirms
   → Frontend confirms payment with Stripe
   → Money held in YOUR Stripe account (escrow)

3. Order is delivered
   → Buyer confirms receipt

4. Platform releases funds
   → Frontend calls POST /api/payout-seller
   → Backend transfers money to seller's account
   → You keep 10% platform fee
```

## Test Cards

Use these in TEST MODE:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires 3D Secure |

Use any future expiry date and any 3-digit CVC.

## Going Live

1. Switch Stripe to **LIVE MODE**
2. Replace test keys with live keys
3. Update `FRONTEND_URL` to production
4. Set up webhook endpoint in Stripe Dashboard
5. Deploy to Railway production
