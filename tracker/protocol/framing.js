/**
 * AVL packet framing helpers (preamble + data length).
 * Manual — based on Teltonika Codec docs.
 */

const PREAMBLE = Buffer.from([0x00, 0x00, 0x00, 0x00]);
const HEADER_SIZE = 8; // preamble + data length
const CRC_SIZE = 4;
const MAX_DATA_FIELD_LENGTH = 1280; // Teltonika typical max packet size

/**
 * Try to extract one complete AVL frame from the front of buffer.
 * @returns {{ complete: false, need?: number } | { complete: true, frame: Buffer, dataField: Buffer, crcBytes: Buffer, dataFieldLength: number, bytesConsumed: number } | { complete: true, error: string, bytesConsumed: number }}
 */
function tryExtractAvlFrame(buffer) {
  if (buffer.length < HEADER_SIZE) {
    return { complete: false, need: HEADER_SIZE };
  }

  // Require zero preamble; if garbage, skip one byte to resync later callers
  if (
    buffer[0] !== 0x00 ||
    buffer[1] !== 0x00 ||
    buffer[2] !== 0x00 ||
    buffer[3] !== 0x00
  ) {
    return {
      complete: true,
      error: 'invalid AVL preamble (expected 00000000)',
      bytesConsumed: 1,
    };
  }

  const dataFieldLength = buffer.readUInt32BE(4);
  if (dataFieldLength < 3 || dataFieldLength > MAX_DATA_FIELD_LENGTH) {
    return {
      complete: true,
      error: `invalid data field length ${dataFieldLength}`,
      bytesConsumed: HEADER_SIZE,
    };
  }

  const totalSize = HEADER_SIZE + dataFieldLength + CRC_SIZE;
  if (buffer.length < totalSize) {
    return { complete: false, need: totalSize };
  }

  const frame = Buffer.from(buffer.subarray(0, totalSize));
  const dataField = frame.subarray(HEADER_SIZE, HEADER_SIZE + dataFieldLength);
  const crcBytes = frame.subarray(HEADER_SIZE + dataFieldLength);

  return {
    complete: true,
    frame,
    dataField,
    crcBytes,
    dataFieldLength,
    bytesConsumed: totalSize,
  };
}

module.exports = {
  PREAMBLE,
  HEADER_SIZE,
  CRC_SIZE,
  MAX_DATA_FIELD_LENGTH,
  tryExtractAvlFrame,
};
