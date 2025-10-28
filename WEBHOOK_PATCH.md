# Webhook Parsing Bug Fix - Unified Diff

**Date:** 2025-10-28  
**Files Changed:** `server.js` (middleware + webhook route only)

---

## UNIFIED DIFF

```diff
--- a/server.js
+++ b/server.js
@@ -369,8 +369,10 @@ app.use(cors({
   credentials: true,
 }));
 
-// ✅ Standard JSON parser for all routes
-app.use(express.json());
+// ✅ Standard JSON parser for all routes (capture raw body for webhook signature verification)
+app.use(express.json({ 
+  verify: (req, res, buf) => { 
+    req.rawBody = buf; 
+  }, 
+  limit: '1mb' 
+}));
 app.use(cookieParser());
 
@@ -713,10 +715,14 @@ app.post('/api/payment/activate-subscription', authenticateToken, async (req, r
 
-// 🎯 Razorpay Webhook Endpoint (Fixed: uses raw body and robust extraction)
-app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
-  const rawBody = req.body; // ✅ Keep raw buffer
+// 🎯 Razorpay Webhook Endpoint (Fixed: uses captured raw body for signature verification)
+app.post('/api/payment/webhook', async (req, res) => {
   console.log('📥 Webhook received from Razorpay');
   
   try {
-    // Parse JSON from raw body
-    const event = JSON.parse(rawBody.toString());
+    // ✅ Get raw body for signature verification (captured by express.json verify callback)
+    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body), 'utf8'));
+    
+    // ✅ Parse event from body (already parsed by express.json or use req.body)
+    const event = req.body || JSON.parse(rawBody.toString('utf8'));
     const eventType = event.event;
     
     // ✅ Extract subscription ID robustly from various payload shapes
```

---

## WHY THIS FIX WORKS

**Problem:** Global `express.json()` parses body → route `express.raw()` tries to parse again → `req.body` is object not buffer → `req.body.toString()` produces "[object Object]"

**Solution:** 
1. Use `verify` callback to capture raw buffer BEFORE parsing
2. Store raw buffer in `req.rawBody`
3. Webhook uses `req.rawBody` for HMAC, `req.body` for data
4. Removed conflicting route-specific `express.raw()`

---

## TEST COMMANDS

### Production Verification:

```bash
# Set secret
export RAZORPAY_WEBHOOK_SECRET="whsec_your_secret"

# Test webhook
PAYLOAD='{"event":"subscription.activated","payload":{"subscription":{"entity":{"id":"sub_test123","current_start":1698508800,"current_end":1701187200}}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" | sed 's/^.* //')

curl -X POST https://gsnsolnedge.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Expected Logs in Azure:
```
📥 Webhook received from Razorpay
🔔 Event: subscription.activated for subscription: sub_test123
⚠️ User not found for subscription: sub_test123 - acknowledging to avoid retries
```

---

## DEPLOYMENT

```bash
# 1. Deploy changes
git add server.js
git commit -m "Fix webhook parsing bug - use raw body capture"
git push origin main

# 2. Monitor Azure logs
# Check for: "📥 Webhook received" and "✅ Webhook processed"

# 3. Test webhook
RAZORPAY_WEBHOOK_SECRET="whsec_xxx" node test-webhook.js production
```

---

**Files Modified:** `server.js`  
**Lines Changed:** ~20 (middleware + webhook route)  
**Test Scripts:** `test-webhook-local.sh`, `test-webhook.js`  
**Documentation:** `WEBHOOK_FIX_SUMMARY.md`
