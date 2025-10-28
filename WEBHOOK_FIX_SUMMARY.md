# Webhook Parsing Bug Fix Summary

**Date:** 2025-10-28  
**Issue:** "[object Object]" is not valid JSON in webhook processing  
**Status:** ✅ FIXED

---

## PROBLEM ROOT CAUSE

The webhook handler was trying to parse `req.body.toString()` which produced "[object Object]" because:

1. Global `express.json()` middleware already parsed the body into an object
2. Route-specific `express.raw()` couldn't access the original raw body
3. `JSON.parse(req.body.toString())` fails because `req.body` is already an object, not a string

---

## FIX IMPLEMENTED

### 1. Updated Global Middleware (Line 370)

**Changed:**
```javascript
// BEFORE:
app.use(express.json());

// AFTER:
app.use(express.json({ 
  verify: (req, res, buf) => { 
    req.rawBody = buf; 
  }, 
  limit: '1mb' 
}));
```

**What it does:** Captures the raw body buffer BEFORE parsing, storing it in `req.rawBody`.

---

### 2. Fixed Webhook Route (Lines 714-743)

**Changed:**
```javascript
// BEFORE:
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body; // ❌ This is the parsed object, not raw buffer
  const event = JSON.parse(rawBody.toString()); // ❌ Produces "[object Object]"

// AFTER:
app.post('/api/payment/webhook', async (req, res) => {
  // ✅ Get raw body for signature verification (captured by express.json verify callback)
  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body), 'utf8'));
  
  // ✅ Parse event from body (already parsed by express.json or use req.body)
  const event = req.body || JSON.parse(rawBody.toString('utf8'));
```

**What it does:**
- Uses `req.rawBody` (captured buffer) for signature verification
- Uses `req.body` (parsed object) for event data
- Falls back gracefully if raw body not available

---

## WHY THIS FIX WORKS

1. **Capture at Parse Time:** The `verify` callback captures raw bytes BEFORE express.json() parses them
2. **Dual Access:** We have both raw body (for HMAC) and parsed body (for data extraction)
3. **No Route Conflicts:** Removed route-specific `express.raw()` that conflicted with global parser
4. **Fallback Safety:** Handles edge cases where raw body might not be captured

---

## TEST COMMANDS

### Test Locally with curl + openssl:

```bash
# Set your webhook secret
export RAZORPAY_WEBHOOK_SECRET="whsec_your_secret_here"

# Create test payload
PAYLOAD='{"event":"subscription.activated","payload":{"subscription":{"entity":{"id":"sub_test123","current_start":1698508800,"current_end":1701187200}}}}'

# Compute signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" | sed 's/^.* //')

# Send webhook
curl -X POST http://localhost:8080/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected output:
# {"received":true,"message":"Processed subscription.activated"}
```

### Test on Production:

```bash
# Same commands, just change URL
curl -X POST https://gsnsolnedge.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Using Test Scripts:

```bash
# Bash script
chmod +x test-webhook-local.sh
RAZORPAY_WEBHOOK_SECRET="whsec_xxx" ./test-webhook-local.sh local

# Node.js script
RAZORPAY_WEBHOOK_SECRET="whsec_xxx" node test-webhook.js local
```

---

## WHAT TO LOOK FOR IN AZURE LOGS

### ✅ Successful Webhook:
```
📥 Webhook received from Razorpay
🔔 Event: subscription.activated for subscription: sub_ABC123
👤 Found user: user@example.com
✅ Webhook processed subscription.activated for user@example.com (sub_ABC123)
```

### ❌ Failed Signature Verification:
```
📥 Webhook received from Razorpay
🔔 Event: subscription.activated for subscription: sub_ABC123
❌ Invalid webhook signature - potential attack!
```

### ⚠️ User Not Found:
```
📥 Webhook received from Razorpay
🔔 Event: subscription.activated for subscription: sub_ABC123
⚠️ User not found for subscription: sub_ABC123 - acknowledging to avoid retries
```

### ❌ Processing Error (returns 200 to avoid retry):
```
📥 Webhook received from Razorpay
❌ Webhook processing error: <error message>
<Response 200 to acknowledge>
```

---

## VERIFICATION STEPS ON PRODUCTION

### Step 1: Check Current Logs

```bash
# Azure Portal → App Service → Log Stream
# Filter for: "Webhook received"
```

### Step 2: Send Test Webhook

```bash
# Copy webhook secret from Azure App Settings
# Run test script
RAZORPAY_WEBHOOK_SECRET="whsec_xxx" node test-webhook.js production
```

### Step 3: Verify Logs

Should see:
- ✅ "📥 Webhook received from Razorpay"
- ✅ "🔔 Event: subscription.activated"
- ✅ "✅ Webhook processed subscription.activated for user@email.com"

No longer see:
- ❌ "[object Object]" is not valid JSON
- ❌ JSON parsing errors

---

## ROLLBACK (If Needed)

### Quick Rollback:

```diff
// server.js line 370
-app.use(express.json({ 
-  verify: (req, res, buf) => { 
-    req.rawBody = buf; 
-  }, 
-  limit: '1mb' 
-}));
+app.use(express.json());

// server.js line 714
-app.post('/api/payment/webhook', async (req, res) => {
+app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
-  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body), 'utf8'));
-  const event = req.body || JSON.parse(rawBody.toString('utf8'));
+  const rawBody = req.body;
+  const event = JSON.parse(rawBody.toString());
```

---

## SECURITY NOTES

✅ **HMAC verification still works:** Signature computed from raw body buffer  
✅ **Timing-safe comparison:** Uses `crypto.timingSafeEqual`  
✅ **Length checks:** Checks signature length before comparison  
✅ **No secrets logged:** Error messages don't expose raw body or secrets  

---

**Fix Applied:** 2025-10-28  
**Files Modified:** `server.js` (lines 370-375, 714-743)  
**Test Files Created:** `test-webhook-local.sh`, `test-webhook.js`  
**Status:** ✅ Ready to Deploy
