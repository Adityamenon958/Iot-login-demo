/**
 * ✅ Temporary demo-only in-memory store for Live Device Data Monitor.
 * ❗ Accepts ANY JSON object — flatten on GET only. No MongoDB.
 * Delete this file after the demo.
 */

const crypto = require('crypto');

const BUFFER_CAPACITY = 100;
const CONNECTED_WINDOW_MS = 10_000;
const RATE_WINDOW_MS = 10_000;

/** @type {Array<{ batchId: string, receivedAt: string, raw: object, latencyMs: number|null }>} */
const batches = [];

let totalPostRequests = 0;
/** Count of flattened leaf fields across all POSTs ever ingested */
let totalFieldUpdates = 0;

/** Timestamps (ms) of recent POSTs for messagesPerSec */
const recentPostTimes = [];

function makeBatchId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function computeLatencyMs(receivedAtIso, sourceTs) {
  if (sourceTs == null || sourceTs === '') return null;
  const receivedMs = Date.parse(receivedAtIso);
  const sourceMs = Date.parse(sourceTs);
  if (Number.isNaN(receivedMs) || Number.isNaN(sourceMs)) return null;
  return Math.round(receivedMs - sourceMs);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * ✅ Structured plan schema: registers[{ name, value, ... }]
 */
function looksLikeRegisterArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every(
    (item) =>
      isPlainObject(item) &&
      item.name != null &&
      String(item.name).trim() !== '' &&
      Object.prototype.hasOwnProperty.call(item, 'value')
  );
}

function formatLeafValue(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Recursively flatten a value into { path, value, address?, unit?, quality? } leaves.
 */
function flattenValue(value, path, out) {
  if (value === null || typeof value !== 'object') {
    out.push({ path, value: formatLeafValue(value) });
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ path, value: '[]' });
      return;
    }
    value.forEach((item, index) => {
      flattenValue(item, `${path}[${index}]`, out);
    });
    return;
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    out.push({ path, value: '{}' });
    return;
  }

  for (const key of keys) {
    const nextPath = path ? `${path}.${key}` : key;
    flattenValue(value[key], nextPath, out);
  }
}

/**
 * ✅ Flatten arbitrary JSON for the table.
 * Also understands the original structured schema (deviceId + registers[]).
 */
function flattenPayload(raw) {
  const out = [];
  if (!isPlainObject(raw)) return out;

  const hasStructuredRegisters = looksLikeRegisterArray(raw.registers);

  // Keys that are better shown on the device card / latency — skip when structured
  const structuredSkipKeys = new Set([
    'deviceId',
    'device_id',
    'deviceName',
    'device_name',
    'sourceTs',
    'source_ts',
    'meta',
    'registers',
  ]);

  for (const [key, value] of Object.entries(raw)) {
    // Structured multi-register schema → one row per register (nice demo labels)
    if (key === 'registers' && hasStructuredRegisters) {
      value.forEach((reg) => {
        out.push({
          path: String(reg.name),
          value: formatLeafValue(reg.value),
          address: reg.address != null ? String(reg.address) : '',
          unit: reg.unit != null ? String(reg.unit) : '',
          quality: reg.quality != null ? String(reg.quality) : '',
        });
      });
      continue;
    }

    if (hasStructuredRegisters && structuredSkipKeys.has(key)) {
      continue;
    }

    flattenValue(value, key, out);
  }

  return out;
}

function pickDeviceFromRaw(raw) {
  if (!isPlainObject(raw)) {
    return {
      deviceId: null,
      deviceName: null,
      communication: null,
      source: null,
    };
  }

  const meta = isPlainObject(raw.meta) ? raw.meta : {};

  const deviceId =
    raw.deviceId != null && String(raw.deviceId).trim() !== ''
      ? String(raw.deviceId)
      : raw.device_id != null && String(raw.device_id).trim() !== ''
        ? String(raw.device_id)
        : isPlainObject(raw.device) && raw.device.id != null
          ? String(raw.device.id)
          : null;

  const deviceName =
    raw.deviceName != null && String(raw.deviceName).trim() !== ''
      ? String(raw.deviceName)
      : raw.device_name != null && String(raw.device_name).trim() !== ''
        ? String(raw.device_name)
        : isPlainObject(raw.device) && raw.device.name != null
          ? String(raw.device.name)
          : null;

  const communication =
    meta.communication != null
      ? String(meta.communication)
      : raw.communication != null
        ? String(raw.communication)
        : null;

  const source =
    meta.source != null
      ? String(meta.source)
      : raw.source != null && typeof raw.source === 'string'
        ? String(raw.source)
        : null;

  return { deviceId, deviceName, communication, source };
}

/**
 * @param {object} rawBody - Exact JSON object from the request (stored unmodified)
 * @returns {{ batchId: string, fieldCount: number, receivedAt: string }}
 */
function pushBatch(rawBody) {
  const receivedAt = new Date().toISOString();
  const batchId = makeBatchId();

  // ✅ Latency is derived metadata only — raw is never mutated
  const sourceTs =
    isPlainObject(rawBody) && rawBody.sourceTs != null ? rawBody.sourceTs : null;
  const latencyMs = computeLatencyMs(receivedAt, sourceTs);

  const leafCount = flattenPayload(rawBody).length;

  const batch = {
    batchId,
    receivedAt,
    latencyMs,
    raw: rawBody,
  };

  batches.unshift(batch);
  if (batches.length > BUFFER_CAPACITY) {
    batches.length = BUFFER_CAPACITY;
  }

  totalPostRequests += 1;
  totalFieldUpdates += leafCount;

  const now = Date.now();
  recentPostTimes.push(now);
  pruneRecentPostTimes(now);

  return {
    batchId,
    fieldCount: leafCount,
    receivedAt,
  };
}

function pruneRecentPostTimes(now = Date.now()) {
  const cutoff = now - RATE_WINDOW_MS;
  while (recentPostTimes.length > 0 && recentPostTimes[0] < cutoff) {
    recentPostTimes.shift();
  }
}

function flattenBatchesToRows() {
  const rows = [];

  for (const batch of batches) {
    const device = pickDeviceFromRaw(batch.raw);
    const leaves = flattenPayload(batch.raw);
    const sourceTs =
      isPlainObject(batch.raw) && batch.raw.sourceTs != null
        ? batch.raw.sourceTs
        : null;

    leaves.forEach((leaf, index) => {
      rows.push({
        id: `${batch.batchId}:${index}`,
        batchId: batch.batchId,
        receivedAt: batch.receivedAt,
        sourceTs,
        latencyMs: batch.latencyMs,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        // ✅ "Field" path — also exposed as registerName for older UI compatibility
        fieldPath: leaf.path,
        registerName: leaf.path,
        registerAddress: leaf.address || '',
        value: leaf.value,
        unit: leaf.unit || '',
        quality: leaf.quality || '',
        raw: batch.raw,
      });
    });
  }

  return rows;
}

function getStats() {
  const now = Date.now();
  pruneRecentPostTimes(now);

  const newest = batches[0] || null;
  const lastReceivedAt = newest ? newest.receivedAt : null;
  const connected =
    lastReceivedAt != null &&
    now - Date.parse(lastReceivedAt) <= CONNECTED_WINDOW_MS;

  const messagesPerSec =
    recentPostTimes.length > 0
      ? Math.round((recentPostTimes.length / (RATE_WINDOW_MS / 1000)) * 100) / 100
      : 0;

  let lastFieldUpdated = null;
  if (newest) {
    const leaves = flattenPayload(newest.raw);
    if (leaves.length > 0) {
      lastFieldUpdated = leaves[0].path;
    }
  }

  return {
    totalPostRequests,
    // ✅ Kept name for UI compatibility — means total flattened fields ingested
    totalRegisterUpdates: totalFieldUpdates,
    lastRegisterUpdated: lastFieldUpdated,
    lastReceivedAt,
    bufferSize: batches.length,
    bufferCapacity: BUFFER_CAPACITY,
    messagesPerSec,
    connected,
  };
}

function getDevice() {
  const newest = batches[0];
  if (!newest) {
    return {
      deviceId: null,
      deviceName: null,
      communication: null,
      source: null,
    };
  }
  return pickDeviceFromRaw(newest.raw);
}

function getLiveDataResponse() {
  return {
    rows: flattenBatchesToRows(),
    device: getDevice(),
    stats: getStats(),
  };
}

function getStatusResponse() {
  return {
    device: getDevice(),
    stats: getStats(),
  };
}

function clear() {
  batches.length = 0;
  recentPostTimes.length = 0;
  totalPostRequests = 0;
  totalFieldUpdates = 0;
}

module.exports = {
  BUFFER_CAPACITY,
  pushBatch,
  flattenPayload,
  getLiveDataResponse,
  getStatusResponse,
  clear,
};
