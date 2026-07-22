/**
 * CRC-16/IBM (CRC-16/ARC) — Teltonika Codec CRC
 * Poly reflected 0xA001, init 0x0000, xorOut 0x0000
 * Manual implementation — no third-party codec libraries.
 */
function crc16Ibm(buffer, offset = 0, length = buffer.length - offset) {
  let crc = 0x0000;
  const end = offset + length;
  for (let i = offset; i < end; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x0001) {
        crc = (crc >>> 1) ^ 0xa001;
      } else {
        crc >>>= 1;
      }
    }
  }
  return crc & 0xffff;
}

/**
 * Validate Teltonika 4-byte CRC field (high 2 bytes usually 0x0000).
 * @returns {{ ok: boolean, expected: number, actual: number }}
 */
function validateTeltonikaCrc(dataField, crcBytes) {
  const expected = crc16Ibm(dataField);
  const actual = crcBytes.readUInt16BE(2); // low 16 bits
  return { ok: expected === actual, expected, actual };
}

module.exports = {
  crc16Ibm,
  validateTeltonikaCrc,
};
