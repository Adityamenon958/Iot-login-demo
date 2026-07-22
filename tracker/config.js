const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

const config = {
  // ✅ TCP listen port for FMB920 / Teltonika devices
  port: intEnv('TRACKER_TCP_PORT', 5027),
  host: process.env.TRACKER_TCP_HOST || '0.0.0.0',

  // ❗ Idle sockets are closed after this many ms with no data
  idleTimeoutMs: intEnv('TRACKER_IDLE_TIMEOUT_MS', 120000),

  // Soft limit — new connections beyond this are destroyed immediately
  maxConnections: intEnv('TRACKER_MAX_CONNECTIONS', 200),

  // Max buffered bytes per socket before force-close (DoS guard)
  maxBufferBytes: intEnv('TRACKER_MAX_BUFFER_BYTES', 65536),

  // Hex dump length for console logs
  hexLogBytes: intEnv('TRACKER_HEX_LOG_BYTES', 64),

  // Store raw packet hex on AvlRecord when true
  storeRawHex: boolEnv('TRACKER_STORE_RAW_HEX', false),

  mongoUri: process.env.MONGO_URI || '',
};

module.exports = config;
