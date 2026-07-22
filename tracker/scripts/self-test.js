/**
 * Lab self-test: register wiki sample IMEI, start TCP briefly, replay fixtures,
 * assert IMEI ACK + AVL ACK + AvlRecord insert.
 *
 * Usage: node tracker/scripts/self-test.js
 */
const path = require('path');
const fs = require('fs');
const net = require('net');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const connectDB = require('../../backend/db');
const Device = require('../../backend/models/Device');
const AvlRecord = require('../../backend/models/AvlRecord');
const config = require('../config');
const { startTcpServer } = require('../server/tcpServer');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const TEST_IMEI = '356307042441013';
const TEST_UID = `tracker-selftest-${TEST_IMEI}`;

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name));
}

function onceData(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for data')), timeoutMs);
    socket.once('data', (buf) => {
      clearTimeout(t);
      resolve(buf);
    });
  });
}

async function main() {
  const port = 15027;
  config.port = port;
  config.host = '127.0.0.1';
  config.idleTimeoutMs = 10000;

  await connectDB();

  let device = await Device.findOne({ imei: TEST_IMEI });
  if (!device) {
    device = await Device.create({
      companyName: 'SelfTest',
      uid: TEST_UID,
      deviceId: `FMB920-${TEST_IMEI.slice(-6)}`,
      deviceType: 'gpsTracker',
      imei: TEST_IMEI,
    });
    console.log('[self-test] created Device', device._id.toString());
  } else {
    console.log('[self-test] using Device', device._id.toString());
  }

  const beforeCount = await AvlRecord.countDocuments({ imei: TEST_IMEI });
  const { close } = startTcpServer(config);

  await new Promise((r) => setTimeout(r, 300));

  const client = net.connect({ host: '127.0.0.1', port });
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });

  // IMEI
  client.write(readFixture('imei.bin'));
  const imeiAck = await onceData(client);
  if (imeiAck.length !== 1 || imeiAck[0] !== 0x01) {
    throw new Error(`expected IMEI ACK 0x01, got ${imeiAck.toString('hex')}`);
  }
  console.log('[self-test] IMEI ACK OK');

  // Valid Codec 8
  client.write(readFixture('codec8.bin'));
  const avlAck = await onceData(client);
  if (avlAck.length !== 4 || avlAck.readUInt32BE(0) !== 1) {
    throw new Error(`expected AVL ACK 00000001, got ${avlAck.toString('hex')}`);
  }
  console.log('[self-test] AVL ACK OK');

  await new Promise((r) => setTimeout(r, 400));
  const afterCount = await AvlRecord.countDocuments({ imei: TEST_IMEI });
  if (afterCount < beforeCount + 1) {
    throw new Error(`expected AvlRecord insert; before=${beforeCount} after=${afterCount}`);
  }
  console.log('[self-test] Mongo AvlRecord OK (count', afterCount, ')');

  // Unknown IMEI reject
  const client2 = net.connect({ host: '127.0.0.1', port });
  await new Promise((resolve, reject) => {
    client2.once('connect', resolve);
    client2.once('error', reject);
  });
  const bad = Buffer.concat([
    Buffer.from([0x00, 0x0f]),
    Buffer.from('999999999999999', 'ascii'),
  ]);
  client2.write(bad);
  const rejectAck = await onceData(client2);
  if (rejectAck[0] !== 0x00) {
    throw new Error(`expected IMEI reject 0x00, got ${rejectAck.toString('hex')}`);
  }
  console.log('[self-test] IMEI reject OK');

  client.destroy();
  client2.destroy();
  await close();
  console.log('[self-test] PASS');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[self-test] FAIL', err);
  process.exit(1);
});
