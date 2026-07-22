const { tryParseImei, buildImeiAck } = require('../protocol/imeiHandler');
const { tryExtractAvlFrame } = require('../protocol/framing');
const { validateTeltonikaCrc } = require('../protocol/crc16');
const { decodeCodec8DataField } = require('../protocol/codec8Decoder');
const { buildAvlAck } = require('../protocol/acknowledger');
const { findDeviceByImei } = require('../services/deviceAuthService');
const { writeAvlRecords } = require('../services/telemetryWriteService');

const STATE = {
  WAIT_IMEI: 'WAIT_IMEI',
  WAIT_AVL: 'WAIT_AVL',
  CLOSED: 'CLOSED',
};

function toHex(buf, maxBytes) {
  const slice = buf.subarray(0, Math.min(buf.length, maxBytes));
  return Buffer.from(slice).toString('hex').replace(/(..)/g, '$1 ').trim();
}

/**
 * Per-socket Teltonika session state machine.
 */
class ConnectionSession {
  /**
   * @param {import('net').Socket} socket
   * @param {object} options
   * @param {object} options.config
   * @param {object} options.stats
   * @param {() => void} options.onClose
   */
  constructor(socket, { config, stats, onClose }) {
    this.socket = socket;
    this.config = config;
    this.stats = stats;
    this.onClose = onClose;

    this.state = STATE.WAIT_IMEI;
    this.buffer = Buffer.alloc(0);
    this.device = null;
    this.imei = null;
    this.remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.processing = false;
    this.closed = false;

    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      console.log(`[tracker] idle timeout ${this.remote}`);
      this.close('idle timeout');
    }, this.config.idleTimeoutMs);
  }

  onData(chunk) {
    if (this.closed) return;
    this._resetIdleTimer();

    this.stats.bytesReceived += chunk.length;
    const preview = toHex(chunk, this.config.hexLogBytes);
    console.log(
      `[tracker] recv ${chunk.length} bytes from ${this.remote}: ${preview}${
        chunk.length > this.config.hexLogBytes ? ' ...' : ''
      }`
    );

    this.buffer = Buffer.concat([this.buffer, chunk]);
    console.log(`[tracker] buffer length: ${this.buffer.length}`);

    if (this.buffer.length > this.config.maxBufferBytes) {
      console.error(`[tracker] buffer overflow ${this.remote} — closing`);
      this.stats.bufferOverflows += 1;
      this.close('buffer overflow');
      return;
    }

    this._pump().catch((err) => {
      console.error(`[tracker] session error ${this.remote}:`, err.message);
      this.stats.sessionErrors += 1;
      this.close('session error');
    });
  }

  async _pump() {
    if (this.processing || this.closed) return;
    this.processing = true;
    try {
      while (!this.closed) {
        if (this.state === STATE.WAIT_IMEI) {
          const progressed = await this._handleImei();
          if (!progressed) break;
        } else if (this.state === STATE.WAIT_AVL) {
          const progressed = await this._handleAvl();
          if (!progressed) break;
        } else {
          break;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  async _handleImei() {
    const parsed = tryParseImei(this.buffer);
    if (!parsed.complete) return false;

    this.buffer = this.buffer.subarray(parsed.bytesConsumed);

    if (parsed.error) {
      console.error(`[tracker] IMEI parse error ${this.remote}: ${parsed.error}`);
      this.stats.authFails += 1;
      this.socket.write(buildImeiAck(false));
      this.close('bad IMEI');
      return false;
    }

    console.log(`[tracker] IMEI received: ${parsed.imei}`);
    const device = await findDeviceByImei(parsed.imei);

    if (!device) {
      console.log(`[tracker] IMEI rejected → 0x00 (closing)`);
      this.stats.authFails += 1;
      this.socket.write(buildImeiAck(false));
      this.close('unknown IMEI');
      return false;
    }

    this.device = device;
    this.imei = parsed.imei;
    this.state = STATE.WAIT_AVL;
    this.stats.authOk += 1;
    console.log(`[tracker] IMEI accepted → 0x01 (device ${device._id})`);
    this.socket.write(buildImeiAck(true));
    return true;
  }

  async _handleAvl() {
    const extracted = tryExtractAvlFrame(this.buffer);

    if (!extracted.complete) {
      if (extracted.need) {
        console.log(
          `[tracker] frame incomplete: have ${this.buffer.length} need ${extracted.need}`
        );
      }
      return false;
    }

    this.buffer = this.buffer.subarray(extracted.bytesConsumed);

    if (extracted.error) {
      console.error(`[tracker] framing error ${this.remote}: ${extracted.error}`);
      this.stats.framingErrors += 1;
      // Drop one byte already consumed by framing helper; continue if buffer left
      return this.buffer.length > 0;
    }

    console.log(
      `[tracker] frame complete: dataLength=${extracted.dataFieldLength} totalBytes=${extracted.frame.length}`
    );

    const crc = validateTeltonikaCrc(extracted.dataField, extracted.crcBytes);
    if (!crc.ok) {
      console.error(
        `[tracker] CRC FAIL expected=${crc.expected
          .toString(16)
          .padStart(4, '0')} got=${crc.actual.toString(16).padStart(4, '0')}`
      );
      this.stats.crcFails += 1;
      // Do not ACK — device should retry
      return this.buffer.length > 0;
    }

    console.log('[tracker] CRC OK');
    this.stats.crcOk += 1;

    let decoded;
    try {
      decoded = decodeCodec8DataField(extracted.dataField);
    } catch (err) {
      console.error(`[tracker] Codec 8 decode error: ${err.message}`);
      this.stats.decodeFails += 1;
      return this.buffer.length > 0;
    }

    console.log(`[tracker] decoded records: ${decoded.recordCount}`);
    decoded.records.forEach((r, i) => {
      console.log(
        `[tracker] record[${i}]:`,
        JSON.stringify({
          timestamp: r.timestamp.toISOString(),
          priority: r.priority,
          latitude: r.latitude,
          longitude: r.longitude,
          altitude: r.altitude,
          angle: r.angle,
          satellites: r.satellites,
          speed: r.speed,
          eventIoId: r.eventIoId,
          ioElements: r.ioElements,
        })
      );
    });

    try {
      const rawHex = extracted.frame.toString('hex');
      const { insertedCount } = await writeAvlRecords({
        device: this.device,
        imei: this.imei,
        codecId: decoded.codecId,
        records: decoded.records,
        crcValid: true,
        rawHex,
      });

      console.log(`[tracker] wrote ${insertedCount} AvlRecord docs`);
      this.stats.recordsWritten += insertedCount;

      const ack = buildAvlAck(insertedCount);
      this.socket.write(ack);
      this.stats.acksSent += 1;
      console.log(`[tracker] AVL ACK → ${ack.toString('hex')}`);
    } catch (err) {
      console.error(`[tracker] Mongo write failed — no ACK: ${err.message}`);
      this.stats.writeFails += 1;
      // No ACK on DB failure so device can retry
    }

    return this.buffer.length > 0;
  }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    this.state = STATE.CLOSED;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    console.log(`[tracker] connection closed ${this.remote}${reason ? ` (${reason})` : ''}`);
    try {
      this.socket.destroy();
    } catch (_) {
      /* ignore */
    }
    if (typeof this.onClose === 'function') this.onClose();
  }
}

module.exports = {
  ConnectionSession,
  STATE,
};
