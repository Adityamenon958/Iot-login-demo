/**
 * Teltonika IMEI first-packet parser (manual).
 * Format: 2-byte BE length + ASCII IMEI digits.
 */

/**
 * Try to parse a complete IMEI message from buffer.
 * @returns {{ complete: false } | { complete: true, imei: string, bytesConsumed: number } | { complete: true, error: string, bytesConsumed: number }}
 */
function tryParseImei(buffer) {
  if (buffer.length < 2) {
    return { complete: false };
  }

  const length = buffer.readUInt16BE(0);
  if (length < 1 || length > 20) {
    return {
      complete: true,
      error: `invalid IMEI length ${length}`,
      bytesConsumed: 2,
    };
  }

  if (buffer.length < 2 + length) {
    return { complete: false };
  }

  const imei = buffer.subarray(2, 2 + length).toString('ascii');
  if (!/^\d+$/.test(imei)) {
    return {
      complete: true,
      error: `IMEI is not numeric: ${JSON.stringify(imei)}`,
      bytesConsumed: 2 + length,
    };
  }

  return {
    complete: true,
    imei,
    bytesConsumed: 2 + length,
  };
}

function buildImeiAck(accepted) {
  return Buffer.from([accepted ? 0x01 : 0x00]);
}

module.exports = {
  tryParseImei,
  buildImeiAck,
};
