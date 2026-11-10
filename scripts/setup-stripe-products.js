// One-time setup: creates the 3 Viele seller subscription products + monthly
// GBP prices in Stripe (idempotent - reuses products/prices marked with a tier).
//
// Usage:  cd viele-backend && node scripts/setup-stripe-products.js
// Then paste the printed lines into your Railway environment variables.
require('dotenv').config();
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY missing - check viele-backend/.env');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TIERS = [
  { tier: 'premiere', name: 'Viele Premiere', amount: 799 },
  { tier: 'pro', name: 'Viele Pro', amount: 1499 },
  { tier: 'pro-plus', name: 'Viele Pro+', amount: 2299 },
];

(async () => {
  const existingProducts = (await stripe.products.list({ limit: 100 })).data;
  const envLines = [];

  for (const t of TIERS) {
    let product = existingProducts.find(p => p.metadata && p.metadata.tier === t.tier);
    if (!product) {
      product = await stripe.products.create({
        name: t.name,
        description: `Viele seller subscription - ${t.name} (monthly)`,
        metadata: { tier: t.tier },
      });
      console.log(`Created product  ${product.name}  (${product.id})`);
    } else {
      console.log(`Found existing product  ${product.name}  (${product.id})`);
    }

    const prices = (await stripe.prices.list({ product: product.id, limit: 10 })).data;
    let price = prices.find(p => p.recurring && p.recurring.interval === 'month');
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: t.amount,
        currency: 'gbp',
        recurring: { interval: 'month' },
        metadata: { tier: t.tier },
      });
      console.log(`Created price  ${price.id}`);
    } else {
      console.log(`Found existing price  ${price.id}`);
    }

    envLines.push(`STRIPE_PRICE_${t.tier.replace(/-/g, '_').toUpperCase()}=${price.id}`);
  }

  console.log('\nAdd these to your Railway environment variables:\n');
  envLines.forEach(l => console.log(l));
})().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
