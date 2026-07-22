const Device = require('../../backend/models/Device');

/**
 * Authenticate tracker IMEI against Device registry.
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function findDeviceByImei(imei) {
  if (!imei) return null;
  return Device.findOne({ imei: String(imei).trim() });
}

module.exports = {
  findDeviceByImei,
};
