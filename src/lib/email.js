const { Resend } = require('resend');

// Initialize Resend with API key
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

  // Debug: log if email service is initialized
console.log('[EMAIL DEBUG] RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
console.log('[EMAIL DEBUG] FROM_EMAIL:', FROM_EMAIL);
console.log('[EMAIL DEBUG] resend client initialized:', !!resend);

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL = process.env.FRONTEND_URL || 'https://www.viele.store';

// Check if email service is available
function isEmailEnabled() {
  return !!resend;
}

// ==========================================
// WELCOME EMAIL (after signup)
// ==========================================
async function sendWelcomeEmail({ to, name }) {
  if (!resend) {
    console.log('[EMAIL MOCK] Welcome email to:', to);
    return { id: 'mock-welcome-' + Date.now() };
  }

  try {
    console.log('[EMAIL DEBUG] Attempting to send to:', to, 'from:', FROM_EMAIL);
    const result = await resend.emails.send({
      from: `Viele <${FROM_EMAIL}>`,
      to,
      subject: 'Welcome to Viele!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">VIELE</h1>
            <p style="margin: 10px 0 0; opacity: 0.8;">Discover the Undiscovered</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <h2 style="font-size: 24px; margin-bottom: 20px;">Welcome, ${name}!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Thanks for joining Viele — the curated marketplace for emerging fashion designers.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Start exploring unique pieces from independent brands around the world.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/shop" 
                 style="background: #000; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-size: 16px; display: inline-block;">
                Start Exploring
              </a>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-top: 40px;">
              If you didn't create this account, please ignore this email.
            </p>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
            <p>Viele Marketplace • London, UK</p>
            <p><a href="${APP_URL}/legal/privacy-policy" style="color: #999;">Privacy Policy</a></p>
          </div>
        </div>
      `,
    });

    console.log(`Welcome email sent to ${to}:`, result.id);
    return result;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw error;
  }
}

// ==========================================
// PASSWORD RESET EMAIL
// ==========================================
async function sendPasswordResetEmail({ to, name, resetToken }) {
  if (!resend) {
    console.log('[EMAIL MOCK] Password reset email to:', to, 'Token:', resetToken);
    return { id: 'mock-reset-' + Date.now() };
  }

  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  try {
    const result = await resend.emails.send({
      from: `Viele <${FROM_EMAIL}>`,
      to,
      subject: 'Reset Your Viele Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">VIELE</h1>
          </div>
          
          <div style="padding: 40px 30px;">
            <h2 style="font-size: 24px; margin-bottom: 20px;">Reset Your Password</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Hi ${name || 'there'},
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              We received a request to reset your Viele password. Click the button below to set a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #000; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-size: 16px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            
            <p style="font-size: 14px; color: #999;">
              Can't click the button? Copy and paste this link:<br>
              <span style="word-break: break-all;">${resetUrl}</span>
            </p>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
            <p>Viele Marketplace • London, UK</p>
          </div>
        </div>
      `,
    });

    console.log(`Password reset email sent to ${to}:`, result.id);
    return result;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

// ==========================================
// ORDER CONFIRMATION EMAIL (to buyer)
// ==========================================
async function sendOrderConfirmationEmail({ to, name, orderId, items, total, shippingAddress }) {
  if (!resend) {
    console.log('[EMAIL MOCK] Order confirmation to:', to, 'Order:', orderId);
    return { id: 'mock-order-' + Date.now() };
  }

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <p style="margin: 0; font-weight: 600;">${item.name}</p>
        <p style="margin: 5px 0 0; color: #999; font-size: 14px;">Qty: ${item.quantity}</p>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        £${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>
  `).join('');

  try {
    const result = await resend.emails.send({
      from: `Viele Orders <${FROM_EMAIL}>`,
      to,
      subject: `Order Confirmed #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">VIELE</h1>
          </div>
          
          <div style="padding: 40px 30px;">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Order Confirmed!</h2>
            <p style="color: #999; margin-bottom: 30px;">Order #${orderId}</p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Hi ${name || 'there'}, thanks for your order! We've received your payment and the seller is preparing your items.
            </p>
            
            <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="margin: 0 0 15px; font-size: 16px;">Order Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                ${itemsHtml}
                <tr>
                  <td colspan="2" style="padding: 10px; text-align: right; font-weight: 600;">Total</td>
                  <td style="padding: 10px; text-align: right; font-weight: 600;">£${total.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px; font-size: 16px;">Shipping Address</h3>
              <p style="margin: 0; color: #555; line-height: 1.6;">
                ${shippingAddress.name}<br>
                ${shippingAddress.address}<br>
                ${shippingAddress.city}, ${shippingAddress.postcode}
              </p>
            </div>
            
            <div style="background: #e8f5e9; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; color: #2e7d32; font-size: 14px;">
                <strong>Payment Status:</strong> Held securely by Viele<br>
                Your payment will be released to the seller once you confirm delivery.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/order/${orderId}" 
                 style="background: #000; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-size: 16px; display: inline-block;">
                Track Order
              </a>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
            <p>Viele Marketplace • London, UK</p>
            <p>Questions? Reply to this email or contact support.</p>
          </div>
        </div>
      `,
    });

    console.log(`Order confirmation sent to ${to}:`, result.id);
    return result;
  } catch (error) {
    console.error('Failed to send order confirmation:', error);
    throw error;
  }
}

// ==========================================
// SELLER ORDER NOTIFICATION
// ==========================================
async function sendSellerOrderNotification({ to, sellerName, orderId, items, total }) {
  if (!resend) {
    console.log('[EMAIL MOCK] Seller notification to:', to, 'Order:', orderId);
    return { id: 'mock-seller-' + Date.now() };
  }

  try {
    const result = await resend.emails.send({
      from: `Viele Seller <${FROM_EMAIL}>`,
      to,
      subject: `New Order #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">VIELE</h1>
            <p style="margin: 10px 0 0; opacity: 0.8;">Seller Dashboard</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <h2 style="font-size: 24px; margin-bottom: 10px;">You Have a New Order!</h2>
            <p style="color: #999; margin-bottom: 30px;">Order #${orderId}</p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Hi ${sellerName},
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              A customer has placed an order. Please prepare the items for shipping within 3 business days.
            </p>
            
            <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="margin: 0 0 15px; font-size: 16px;">Order Details</h3>
              <p style="margin: 0 0 10px;"><strong>Items:</strong> ${items.length} item(s)</p>
              <p style="margin: 0 0 10px;"><strong>Total:</strong> £${total.toFixed(2)}</p>
              <p style="margin: 0; color: #666;">You will receive £${(total * 0.9).toFixed(2)} after our 10% platform fee.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/seller/orders" 
                 style="background: #000; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-size: 16px; display: inline-block;">
                View Order
              </a>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
            <p>Viele Marketplace • Seller Support</p>
          </div>
        </div>
      `,
    });

    console.log(`Seller notification sent to ${to}:`, result.id);
    return result;
  } catch (error) {
    console.error('Failed to send seller notification:', error);
    throw error;
  }
}

// ==========================================
// PAYOUT CONFIRMATION EMAIL (to seller)
// ==========================================
async function sendPayoutConfirmationEmail({ to, sellerName, amount, orderId }) {
  if (!resend) {
    console.log('[EMAIL MOCK] Payout confirmation to:', to, 'Amount:', amount);
    return { id: 'mock-payout-' + Date.now() };
  }

  try {
    const result = await resend.emails.send({
      from: `Viele Payments <${FROM_EMAIL}>`,
      to,
      subject: 'Payout Processed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">VIELE</h1>
          </div>
          
          <div style="padding: 40px 30px; text-align: center;">
            <h2 style="font-size: 24px; margin-bottom: 20px;">Payout Processed!</h2>
            <p style="font-size: 16px; color: #333;">Hi ${sellerName},</p>
            
            <div style="background: #e8f5e9; border-radius: 12px; padding: 30px; margin: 30px 0;">
              <p style="margin: 0 0 10px; color: #2e7d32; font-size: 14px;">AMOUNT</p>
              <p style="margin: 0; font-size: 36px; font-weight: bold; color: #2e7d32;">£${parseFloat(amount).toFixed(2)}</p>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">Order #${orderId}</p>
            </div>
            
            <p style="font-size: 14px; color: #999;">
              Funds will appear in your account within 3-5 business days.
            </p>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
            <p>Viele Marketplace • Seller Payments</p>
          </div>
        </div>
      `,
    });

    console.log(`Payout confirmation sent to ${to}:`, result.id);
    return result;
  } catch (error) {
    console.error('Failed to send payout confirmation:', error);
    throw error;
  }
}

module.exports = {
  isEmailEnabled,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendSellerOrderNotification,
  sendPayoutConfirmationEmail,
};
