/**
 * Build Teltonika AVL ACK: 4-byte big-endian record count.
 */
function buildAvlAck(recordCount) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(recordCount >>> 0, 0);
  return buf;
}

module.exports = {
  buildAvlAck,
};
