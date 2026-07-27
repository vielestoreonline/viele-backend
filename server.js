const { sendWelcomeEmail, sendPasswordResetEmail, sendOrderConfirmationEmail, sendSellerOrderNotification, sendPayoutConfirmationEmail } = require('./src/lib/email');
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
require('dotenv').config();
const emailService = require('./src/lib/email');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// CORS - allow requests from your Vercel frontend
const allowedOrigins = [
  'http://localhost:5173',           // Local dev
  'http://localhost:3000',           // Local dev alt
  'https://www.viele.store',         // Production custom domain
  'https://viele-store.vercel.app',  // Production Vercel
  'https://viele-store-f40hheqny-vielestoreonline-8278s-projects.vercel.app',
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(null, true); // Allow all for now during development
    }
  },
  credentials: true,
}));

// Parse JSON for regular routes
app.use(express.json());

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Viele API is running',
    version: '1.0.0',
    stripeConnected: !!process.env.STRIPE_SECRET_KEY,
  });
});

// ==========================================
// CREATE PAYMENT INTENT (Buyer pays)
// ==========================================
// This creates a payment that holds money in YOUR Stripe account
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'gbp', orderId, buyerEmail, sellerStripeAccountId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Calculate platform fee (10%)
    const platformFee = Math.round(amount * 0.10);

    // Create payment intent
    // Money goes to YOUR platform account (escrow/holding)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to pence/cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: orderId || `order_${Date.now()}`,
        buyerEmail: buyerEmail || '',
        platformFee: platformFee.toString(),
        sellerReceives: (amount - platformFee).toString(),
        ...(sellerStripeAccountId && { sellerAccount: sellerStripeAccountId }),
      },
      // Optional: capture_method: 'manual' for delayed capture
    });

    console.log(`Payment intent created: ${paymentIntent.id} for £${amount}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      platformFee: platformFee,
      sellerReceives: amount - platformFee,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message,
    });
  }
});

// ==========================================
// CONFIRM PAYMENT (After buyer confirms)
// ==========================================
app.post('/api/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not successful',
        status: paymentIntent.status,
      });
    }

    console.log(`Payment confirmed: ${paymentIntentId}`);

    res.json({
      status: 'success',
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CREATE SELLER CONNECTED ACCOUNT
// ==========================================
// When a seller signs up, create a Stripe Connect account for them
app.post('/api/create-seller-account', async (req, res) => {
  try {
    const { email, name, country = 'GB' } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Create a Standard Connect account for the seller
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      business_type: 'individual',
      individual: {
        first_name: name.split(' ')[0] || name,
        last_name: name.split(' ').slice(1).join(' ') || '',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        sellerName: name,
      },
    });

    console.log(`Seller account created: ${account.id} for ${email}`);

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL || 'https://www.viele.store'}/seller/onboarding?refresh=true`,
      return_url: `${process.env.FRONTEND_URL || 'https://www.viele.store'}/seller/onboarding?success=true`,
      type: 'account_onboarding',
    });

    res.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error('Error creating seller account:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PAYOUT TO SELLER (Release funds after delivery)
// ==========================================
// Transfer money from your account to the seller's connected account
app.post('/api/payout-seller', async (req, res) => {
  try {
    const { sellerStripeAccountId, amount, orderId, description } = req.body;

    if (!sellerStripeAccountId || !amount) {
      return res.status(400).json({
        error: 'sellerStripeAccountId and amount are required',
      });
    }

    // Create a transfer to the seller's connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to pence/cents
      currency: 'gbp',
      destination: sellerStripeAccountId,
      metadata: {
        orderId: orderId || '',
        description: description || 'Seller payout',
      },
    });

    console.log(`Payout to seller: £${amount} → ${sellerStripeAccountId}`);

    res.json({
      transferId: transfer.id,
      amount: amount,
      status: transfer.status,
      sellerAccount: sellerStripeAccountId,
    });
  } catch (error) {
    console.error('Error creating payout:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET PAYOUT STATUS
// ==========================================
app.get('/api/payout/:transferId', async (req, res) => {
  try {
    const { transferId } = req.params;
    const transfer = await stripe.transfers.retrieve(transferId);

    res.json({
      transferId: transfer.id,
      amount: transfer.amount / 100,
      status: transfer.status,
      destination: transfer.destination,
      created: new Date(transfer.created * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error retrieving payout:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WEBHOOK HANDLER (Stripe sends events here)
// ==========================================
// This MUST use express.raw() to verify the signature
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret && sig) {
      // Verify signature in production
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Parse without verification (development only)
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Webhook received: ${event.type}`);

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`Payment succeeded: ${paymentIntent.id}`);
      console.log(`Amount: £${paymentIntent.amount / 100}`);
      console.log(`Metadata:`, paymentIntent.metadata);

      // TODO: Update order status in Firestore
      // TODO: Send confirmation email to buyer
      // TODO: Notify seller of new order
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log(`Payment failed: ${failedPayment.id}`);
      console.log(`Failure message:`, failedPayment.last_payment_error?.message);

      // TODO: Update order status to 'payment_failed'
      // TODO: Notify buyer of failed payment
      break;

    case 'transfer.paid':
      const transfer = event.data.object;
      console.log(`Transfer paid: ${transfer.id}`);
      console.log(`Seller received: £${transfer.amount / 100}`);

      // TODO: Update payout status in Firestore
      // TODO: Send payout confirmation to seller
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// ==========================================
// GET PLATFORM BALANCE
// ==========================================
app.get('/api/balance', async (req, res) => {
  try {
    const balance = await stripe.balance.retrieve();
    res.json({
      available: balance.available.map(b => ({
        amount: b.amount / 100,
        currency: b.currency,
      })),
      pending: balance.pending.map(b => ({
        amount: b.amount / 100,
        currency: b.currency,
      })),
    });
  } catch (error) {
    console.error('Error retrieving balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET TRANSACTIONS
// ==========================================
app.get('/api/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const charges = await stripe.charges.list({
      limit,
    });

    res.json({
      transactions: charges.data.map(charge => ({
        id: charge.id,
        amount: charge.amount / 100,
        currency: charge.currency,
        status: charge.status,
        description: charge.description,
        created: new Date(charge.created * 1000).toISOString(),
        receipt_url: charge.receipt_url,
      })),
    });
  } catch (error) {
    console.error('Error retrieving transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EMAIL API Routes
// ==========================================

// Send welcome email
app.post('/api/email/welcome', async (req, res) => {
  try {
    const { to, name } = req.body;
    if (!to || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    const result = await sendWelcomeEmail(to, name);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send password reset email
app.post('/api/email/password-reset', async (req, res) => {
  try {
    const { to, resetUrl } = req.body;
    if (!to || !resetUrl) {
      return res.status(400).json({ error: 'Email and reset URL are required' });
    }
    const result = await sendPasswordResetEmail(to, resetUrl);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Password reset email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send order confirmation email
app.post('/api/email/order-confirmation', async (req, res) => {
  try {
    const { to, orderDetails } = req.body;
    if (!to || !orderDetails) {
      return res.status(400).json({ error: 'Email and order details are required' });
    }
    const result = await sendOrderConfirmationEmail(to, orderDetails);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Order confirmation email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send seller order notification
app.post('/api/email/seller-notification', async (req, res) => {
  try {
    const { to, orderDetails } = req.body;
    if (!to || !orderDetails) {
      return res.status(400).json({ error: 'Email and order details are required' });
    }
    const result = await sendSellerOrderNotification(to, orderDetails);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Seller notification email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send payout confirmation email
app.post('/api/email/payout-confirmation', async (req, res) => {
  try {
    const { to, payoutDetails } = req.body;
    if (!to || !payoutDetails) {
      return res.status(400).json({ error: 'Email and payout details are required' });
    }
    const result = await sendPayoutConfirmationEmail(to, payoutDetails);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Payout email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email service status check
app.get('/api/email/status', (req, res) => {
  try {
    res.json({
      status: 'operational',
      service: 'Resend',
      domain: process.env.RESEND_DOMAIN || 'Not configured'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(port, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       VIELE API SERVER RUNNING           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Port:     ${port}                          ║`);
  console.log(`║  Stripe:   ${process.env.STRIPE_SECRET_KEY ? '✅ Connected' : '❌ Missing'}            ║`);
  console.log(`║  Webhook:  ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Configured' : '⚠️  Dev mode'}        ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /api/create-payment-intent  - Create a payment');
  console.log('  POST /api/confirm-payment        - Confirm payment succeeded');
  console.log('  POST /api/create-seller-account  - Create seller Stripe account');
  console.log('  POST /api/payout-seller          - Release funds to seller');
  console.log('  GET  /api/payout/:transferId     - Check payout status');
  console.log('  GET  /api/balance                - View platform balance');
  console.log('  GET  /api/transactions           - View transactions');
  console.log('  POST /api/webhook                - Stripe webhook endpoint');
});
