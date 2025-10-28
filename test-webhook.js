// Node.js Webhook Test Script
// Usage: node test-webhook.js [local|production] [event_type]

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const env = process.argv[2] || 'local';
const eventType = process.argv[3] || 'subscription.activated';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_your_secret_here';
const url = env === 'local' 
  ? 'http://localhost:8080/api/payment/webhook'
  : 'https://gsnsolnedge.com/api/payment/webhook';

// Generate test payload
const now = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({
  event: eventType,
  payload: {
    subscription: {
      entity: {
        id: 'sub_test_ABC123XYZ',
        current_start: now,
        current_end: now + 2592000 // 30 days
      }
    }
  },
  created_at: now
});

// Compute HMAC signature
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
    'Content-Length': Buffer.byteLength(payload)
  }
};

const client = url.startsWith('https:') ? https : http;

console.log('📤 Testing webhook at:', url);
console.log('📅 Event:', eventType);
console.log('🔐 Signature:', signature.substring(0, 16) + '...');
console.log('');

const req = client.request(url, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 HTTP Status:', res.statusCode);
    console.log('📦 Response:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook test passed!');
    } else {
      console.log('❌ Webhook test failed');
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.write(payload);
req.end();
