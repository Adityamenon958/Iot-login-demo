const AvlRecord = require('../../backend/models/AvlRecord');
const config = require('../config');

/**
 * Persist decoded Codec 8 records. One Mongo doc per AVL record.
 * Documents reference Device; do not copy companyName/uid/deviceId.
 */
async function writeAvlRecords({ device, imei, codecId, records, crcValid, rawHex }) {
  if (!records || records.length === 0) {
    return { insertedCount: 0 };
  }

  const receivedAt = new Date();
  const docs = records.map((r) => ({
    device: device._id,
    imei,
    codecId,
    priority: r.priority,
    timestamp: r.timestamp,
    longitude: r.longitude,
    latitude: r.latitude,
    altitude: r.altitude,
    angle: r.angle,
    satellites: r.satellites,
    speed: r.speed,
    eventIoId: r.eventIoId,
    ioElements: r.ioElements,
    crcValid: !!crcValid,
    receivedAt,
    ...(config.storeRawHex && rawHex ? { rawHex } : {}),
  }));

  const result = await AvlRecord.insertMany(docs, { ordered: true });
  return { insertedCount: result.length };
}

module.exports = {
  writeAvlRecords,
};
