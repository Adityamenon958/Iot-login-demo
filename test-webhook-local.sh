#!/bin/bash
# Test Webhook Endpoint - Local/Production
# Usage: ./test-webhook-local.sh [local|production] [event_type]

ENV="${1:-local}"
EVENT_TYPE="${2:-subscription.activated}"

if [ "$ENV" = "local" ]; then
  URL="http://localhost:8080/api/payment/webhook"
else
  URL="https://gsnsolnedge.com/api/payment/webhook"
fi

WEBHOOK_SECRET="${RAZORPAY_WEBHOOK_SECRET:-whsec_your_secret_here}"

# Generate test payload
PAYLOAD=$(cat <<EOF
{
  "event": "$EVENT_TYPE",
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_test_ABC123XYZ",
        "current_start": $(date +%s),
        "current_end": $(($(date +%s) + 2592000))
      }
    }
  },
  "created_at": $(date +%s)
}
EOF
)

# Compute HMAC signature using openssl
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

echo "Testing webhook at: $URL"
echo "Event: $EVENT_TYPE"
echo "Signature: ${SIGNATURE:0:16}..."
echo ""
echo "Sending webhook..."

# Send webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIGNATURE" \
  -d "$PAYLOAD")

# Extract status code and body
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo ""
echo "HTTP Status: $HTTP_STATUS"
echo "Response: $BODY"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Webhook test passed!"
else
  echo "❌ Webhook test failed"
fi
