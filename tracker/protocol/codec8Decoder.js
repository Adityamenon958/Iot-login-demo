/**
 * Manual Teltonika Codec 8 AVL decoder.
 * Based on official wiki — no third-party codec libraries.
 */

const COORD_SCALE = 10_000_000;

function readSignedInt32BE(buf, offset) {
  return buf.readInt32BE(offset);
}

function decodeGpsElement(buf, offset) {
  const longitudeRaw = readSignedInt32BE(buf, offset);
  const latitudeRaw = readSignedInt32BE(buf, offset + 4);
  const altitude = buf.readInt16BE(offset + 8);
  const angle = buf.readUInt16BE(offset + 10);
  const satellites = buf.readUInt8(offset + 12);
  const speed = buf.readUInt16BE(offset + 13);

  return {
    gps: {
      longitude: longitudeRaw / COORD_SCALE,
      latitude: latitudeRaw / COORD_SCALE,
      altitude,
      angle,
      satellites,
      speed,
      longitudeRaw,
      latitudeRaw,
    },
    bytesRead: 15,
  };
}

function readIoGroup(buf, offset, count, valueSize) {
  const elements = [];
  let pos = offset;
  for (let i = 0; i < count; i += 1) {
    if (pos + 1 + valueSize > buf.length) {
      throw new Error('IO element truncated');
    }
    const id = buf.readUInt8(pos);
    pos += 1;
    let value;
    if (valueSize === 1) value = buf.readUInt8(pos);
    else if (valueSize === 2) value = buf.readUInt16BE(pos);
    else if (valueSize === 4) value = buf.readUInt32BE(pos);
    else if (valueSize === 8) {
      // Store as string to avoid JS bigint serialization issues in Mongo by default
      value = buf.readBigUInt64BE(pos).toString();
    }
    pos += valueSize;
    elements.push({ id, value, valueSize });
  }
  return { elements, bytesRead: pos - offset };
}

function decodeIoElement(buf, offset) {
  let pos = offset;
  if (pos + 2 > buf.length) throw new Error('IO header truncated');

  const eventIoId = buf.readUInt8(pos);
  pos += 1;
  const totalIo = buf.readUInt8(pos);
  pos += 1;

  const all = [];

  if (pos >= buf.length) throw new Error('IO N1 truncated');
  const n1 = buf.readUInt8(pos);
  pos += 1;
  const g1 = readIoGroup(buf, pos, n1, 1);
  all.push(...g1.elements);
  pos += g1.bytesRead;

  if (pos >= buf.length) throw new Error('IO N2 truncated');
  const n2 = buf.readUInt8(pos);
  pos += 1;
  const g2 = readIoGroup(buf, pos, n2, 2);
  all.push(...g2.elements);
  pos += g2.bytesRead;

  if (pos >= buf.length) throw new Error('IO N4 truncated');
  const n4 = buf.readUInt8(pos);
  pos += 1;
  const g4 = readIoGroup(buf, pos, n4, 4);
  all.push(...g4.elements);
  pos += g4.bytesRead;

  if (pos >= buf.length) throw new Error('IO N8 truncated');
  const n8 = buf.readUInt8(pos);
  pos += 1;
  const g8 = readIoGroup(buf, pos, n8, 8);
  all.push(...g8.elements);
  pos += g8.bytesRead;

  const sum = n1 + n2 + n4 + n8;
  if (sum !== totalIo) {
    throw new Error(`IO count mismatch: N=${totalIo} but N1+N2+N4+N8=${sum}`);
  }

  return {
    io: {
      eventIoId,
      totalIo,
      elements: all,
    },
    bytesRead: pos - offset,
  };
}

function decodeAvlRecord(buf, offset) {
  let pos = offset;
  if (pos + 8 + 1 + 15 > buf.length) {
    throw new Error('AVL record header/GPS truncated');
  }

  const timestampMs = Number(buf.readBigUInt64BE(pos));
  pos += 8;
  const priority = buf.readUInt8(pos);
  pos += 1;

  const { gps, bytesRead: gpsBytes } = decodeGpsElement(buf, pos);
  pos += gpsBytes;

  const { io, bytesRead: ioBytes } = decodeIoElement(buf, pos);
  pos += ioBytes;

  return {
    record: {
      timestamp: new Date(timestampMs),
      timestampMs,
      priority,
      longitude: gps.longitude,
      latitude: gps.latitude,
      altitude: gps.altitude,
      angle: gps.angle,
      satellites: gps.satellites,
      speed: gps.speed,
      eventIoId: io.eventIoId,
      ioElements: io.elements,
    },
    bytesRead: pos - offset,
  };
}

/**
 * Decode Codec 8 data field (Codec ID .. Number of Data 2 inclusive).
 * @param {Buffer} dataField
 */
function decodeCodec8DataField(dataField) {
  if (!dataField || dataField.length < 3) {
    throw new Error('data field too short');
  }

  let pos = 0;
  const codecId = dataField.readUInt8(pos);
  pos += 1;

  if (codecId !== 0x08) {
    throw new Error(`unsupported codec id 0x${codecId.toString(16)} (expected 0x08)`);
  }

  const numberOfData1 = dataField.readUInt8(pos);
  pos += 1;

  const records = [];
  for (let i = 0; i < numberOfData1; i += 1) {
    const { record, bytesRead } = decodeAvlRecord(dataField, pos);
    records.push(record);
    pos += bytesRead;
  }

  if (pos >= dataField.length) {
    throw new Error('missing Number of Data 2');
  }
  const numberOfData2 = dataField.readUInt8(pos);
  pos += 1;

  if (numberOfData1 !== numberOfData2) {
    throw new Error(
      `record count mismatch: NumberOfData1=${numberOfData1} NumberOfData2=${numberOfData2}`
    );
  }

  if (pos !== dataField.length) {
    throw new Error(
      `trailing bytes after Number of Data 2: consumed=${pos} length=${dataField.length}`
    );
  }

  return {
    codecId,
    recordCount: numberOfData1,
    records,
  };
}

module.exports = {
  COORD_SCALE,
  decodeCodec8DataField,
  decodeAvlRecord,
};
