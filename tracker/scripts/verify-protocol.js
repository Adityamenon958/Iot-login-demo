/**
 * Offline protocol verification (no Mongo required).
 * Proves IMEI parse, framing, CRC, Codec 8 decode against fixtures.
 *
 * Usage: node tracker/scripts/verify-protocol.js
 */
const fs = require('fs');
const path = require('path');
const { tryParseImei, buildImeiAck } = require('../protocol/imeiHandler');
const { tryExtractAvlFrame } = require('../protocol/framing');
const { validateTeltonikaCrc } = require('../protocol/crc16');
const { decodeCodec8DataField } = require('../protocol/codec8Decoder');
const { buildAvlAck } = require('../protocol/acknowledger');

const FIX = path.join(__dirname, '..', 'fixtures');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const imeiBuf = fs.readFileSync(path.join(FIX, 'imei.bin'));
  const codec8 = fs.readFileSync(path.join(FIX, 'codec8.bin'));
  const badCrc = fs.readFileSync(path.join(FIX, 'bad-crc.bin'));

  const imei = tryParseImei(imeiBuf);
  assert(imei.complete && imei.imei === '356307042441013', 'IMEI parse failed');
  assert(buildImeiAck(true)[0] === 0x01, 'IMEI ACK accept');
  assert(buildImeiAck(false)[0] === 0x00, 'IMEI ACK reject');
  console.log('IMEI OK');

  // Partial frame
  const partial = tryExtractAvlFrame(codec8.subarray(0, 10));
  assert(!partial.complete, 'partial frame should be incomplete');
  console.log('framing partial OK');

  const framed = tryExtractAvlFrame(codec8);
  assert(framed.complete && !framed.error, 'full frame extract failed');
  assert(framed.dataFieldLength === 0x36, 'data length');
  console.log('framing complete OK');

  const crcOk = validateTeltonikaCrc(framed.dataField, framed.crcBytes);
  assert(crcOk.ok, 'CRC should pass on codec8.bin');
  console.log('CRC OK');

  const badFrame = tryExtractAvlFrame(badCrc);
  const crcBad = validateTeltonikaCrc(badFrame.dataField, badFrame.crcBytes);
  assert(!crcBad.ok, 'CRC should fail on bad-crc.bin');
  console.log('CRC fail path OK');

  const decoded = decodeCodec8DataField(framed.dataField);
  assert(decoded.codecId === 0x08, 'codec id');
  assert(decoded.recordCount === 1, 'record count');
  assert(decoded.records[0].timestamp.toISOString() === '2019-06-10T10:04:46.000Z', 'timestamp');
  assert(decoded.records[0].priority === 1, 'priority');
  assert(decoded.records[0].latitude === 0 && decoded.records[0].longitude === 0, 'gps zeros');
  assert(decoded.records[0].ioElements.length === 5, 'io count');
  console.log('Codec 8 decode OK', {
    timestamp: decoded.records[0].timestamp.toISOString(),
    ioIds: decoded.records[0].ioElements.map((e) => e.id),
  });

  const ack = buildAvlAck(1);
  assert(ack.toString('hex') === '00000001', 'AVL ACK');
  console.log('AVL ACK OK');

  // Multi-chunk reassembly simulation
  const chunk1 = codec8.subarray(0, 20);
  const chunk2 = codec8.subarray(20);
  let buf = Buffer.from(chunk1);
  let r = tryExtractAvlFrame(buf);
  assert(!r.complete, 'chunk1 incomplete');
  buf = Buffer.concat([buf, chunk2]);
  r = tryExtractAvlFrame(buf);
  assert(r.complete && !r.error, 'reassembled frame');
  console.log('multi-chunk framing OK');

  console.log('[verify-protocol] PASS');
}

main();
