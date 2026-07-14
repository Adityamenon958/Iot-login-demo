/**
 * ✅ Temporary demo-only routes for Live Device Data Monitor.
 * ❗ Isolated under /api/demo — delete after the client demo.
 *
 * --- Desktop bridge contract (universal JSON) ---
 * POST  https://gsnsolnedge.com/api/demo/live-data
 * Content-Type: application/json
 *
 * Body: ANY JSON object. No required fields. No API key.
 *
 * Examples:
 *   { "weight": 1250.5, "temperature": 32.1 }
 *   { "gross": 1200, "net": 1180, "tare": 20 }
 *   { "device": { "status": "Running", "temperature": 34 } }
 *
 * Suggested push interval: on change or every 500ms–1s while demo is live.
 */

const express = require('express');
const store = require('../services/demoLiveDataStore');

const router = express.Router();

/**
 * ✅ Only requirement: body is a non-null JSON object (not array / primitive).
 * Store the object exactly as Express parsed it — no field stripping.
 */
function validateIngestBody(body) {
  if (body === null || body === undefined) {
    return { ok: false, details: ['Body must be a JSON object'] };
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, details: ['Body must be a JSON object (not an array or primitive)'] };
  }
  return { ok: true, details: [], payload: body };
}

// ✅ Public — demo page polls this
router.get('/live-data', (req, res) => {
  res.json(store.getLiveDataResponse());
});

// ✅ Public — connection / device summary
router.get('/live-data/status', (req, res) => {
  res.json(store.getStatusResponse());
});

// ✅ Public ingest — accepts any JSON object
router.post('/live-data', (req, res) => {
  const result = validateIngestBody(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: 'Validation failed', details: result.details });
  }

  const { batchId, fieldCount, receivedAt } = store.pushBatch(result.payload);
  return res.status(201).json({
    ok: true,
    batchId,
    fieldCount,
    receivedAt,
  });
});

// ✅ Public clear
router.post('/live-data/clear', (req, res) => {
  store.clear();
  res.json({ ok: true, cleared: true });
});

router.delete('/live-data', (req, res) => {
  store.clear();
  res.json({ ok: true, cleared: true });
});

module.exports = router;
