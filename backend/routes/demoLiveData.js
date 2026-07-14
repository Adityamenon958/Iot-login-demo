/**
 * ✅ Temporary demo-only routes for Live Device Data Monitor.
 * ❗ Isolated under /api/demo — delete after the client demo.
 *
 * --- Desktop bridge contract (universal JSON) ---
 * POST  {base}/api/demo/live-data
 * Header: x-demo-api-key: <DEMO_API_KEY>
 * Content-Type: application/json
 *
 * Body: ANY JSON object. No required fields.
 *
 * Examples:
 *   { "weight": 1250.5, "temperature": 32.1 }
 *   { "gross": 1200, "net": 1180, "tare": 20 }
 *   { "device": { "status": "Running", "temperature": 34 } }
 *
 * Structured schema still works (deviceId + registers[]):
 * {
 *   "deviceId": "MINT-CP-01",
 *   "deviceName": "Masibus Mint CP",
 *   "sourceTs": "2026-07-14T05:30:00.000Z",
 *   "registers": [
 *     { "name": "Gross Weight", "address": "40001", "value": 1250.5, "unit": "kg", "quality": "good" }
 *   ]
 * }
 *
 * Env: DEMO_API_KEY (required for POST/clear)
 *      ENABLE_DEMO_LIVE_DATA=true (required in production)
 * Suggested push interval: on change or every 500ms–1s while demo is live.
 */

const express = require('express');
const store = require('../services/demoLiveDataStore');

const router = express.Router();

const DEMO_ENABLED =
  process.env.NODE_ENV === 'production'
    ? process.env.ENABLE_DEMO_LIVE_DATA === 'true'
    : process.env.ENABLE_DEMO_LIVE_DATA !== 'false' &&
      process.env.ENABLE_DEMO_LIVE_DATA !== '0';

function requireDemoEnabled(req, res, next) {
  if (!DEMO_ENABLED) {
    return res.status(404).json({ message: 'API route not found' });
  }
  next();
}

router.use(requireDemoEnabled);

/**
 * ✅ Protects POST/clear — desktop bridge sends x-demo-api-key
 */
function requireDemoApiKey(req, res, next) {
  const configuredKey = process.env.DEMO_API_KEY;
  if (!configuredKey) {
    return res.status(503).json({
      error: 'DEMO_API_KEY is not configured on the server',
      details: ['Set DEMO_API_KEY in the environment before ingesting demo data'],
    });
  }

  const provided =
    req.get('x-demo-api-key') ||
    req.get('X-Demo-Api-Key') ||
    '';

  if (!provided || provided !== configuredKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: ['Missing or invalid x-demo-api-key header'],
    });
  }

  next();
}

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

// ✅ Ingest — requires DEMO_API_KEY; accepts any JSON object
router.post('/live-data', requireDemoApiKey, (req, res) => {
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

// ✅ Clear buffer — requires DEMO_API_KEY
router.post('/live-data/clear', requireDemoApiKey, (req, res) => {
  store.clear();
  res.json({ ok: true, cleared: true });
});

router.delete('/live-data', requireDemoApiKey, (req, res) => {
  store.clear();
  res.json({ ok: true, cleared: true });
});

module.exports = router;
