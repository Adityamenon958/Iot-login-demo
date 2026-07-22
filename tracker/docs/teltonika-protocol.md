# Teltonika TCP / Codec 8 Protocol Reference

Living protocol reference for this project's tracker server (FMB920 and compatible devices).

Primary source: [Teltonika Data Sending Protocols](https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols) and [Codec](https://wiki.teltonika-gps.com/view/Codec) (Codec 8).

All parsing in this repo is implemented **manually**. Do not use third-party Codec 8 libraries.

---

## 1. TCP connection sequence

1. Device opens a TCP connection to the configured host and port (e.g. `TRACKER_TCP_PORT`).
2. Server accepts the socket and waits for the **first application message**: the IMEI handshake (not Codec 8).
3. Server replies with one byte: `0x01` (accept) or `0x00` (reject).
4. On accept, the same TCP socket stays open. The device sends AVL data packets; the server replies with AVL ACKs.
5. On reject, idle timeout, or error, the server closes the socket. The device typically reconnects later.

```text
Device                         Server
  |-- TCP connect ------------->|
  |-- IMEI (len + ASCII) ------>|
  |<-- 0x01 or 0x00 ------------|
  |-- AVL packet -------------->|
  |<-- AVL ACK (4 bytes) -------|
  |-- AVL packet -------------->|
  |<-- AVL ACK -----------------|
  |         ...                 |
```

---

## 2. IMEI handshake

The first message from the device is **not** an AVL packet.

| Field | Size | Endian | Description |
|-------|------|--------|-------------|
| IMEI length | 2 bytes | big-endian | Number of IMEI ASCII bytes |
| IMEI | N bytes | ASCII digits | Usually 15 digits |

### Example

IMEI `356307042441013`:

```text
00 0F 33 35 36 33 30 37 30 34 32 34 34 31 30 31 33
^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
len=15   ASCII "356307042441013"
```

Hex string: `000F333536333037303432343431303133`

Fixture: `tracker/fixtures/imei.bin`

---

## 3. IMEI acknowledgement

Server → device: **exactly 1 byte**

| Value | Meaning |
|-------|---------|
| `0x01` | Accept — IMEI allowed; wait for AVL |
| `0x00` | Reject — close the connection |

Must be sent as raw binary (not ASCII `"01"`).

---

## 4. AVL packet sequence (after auth)

1. Device sends a binary AVL data packet (may arrive in multiple TCP chunks).
2. Server buffers until a complete frame is available (preamble + data length + payload + CRC).
3. Server validates CRC-16 over the data field.
4. Server decodes Codec 8 records.
5. Server persists records (this project) then sends AVL ACK = number of records accepted.
6. If ACK count does not match what the device sent, the device **resends** the same packet.
7. Loop until disconnect / idle timeout.

---

## 5. Codec 8 packet overview

All multi-byte integers are **big-endian** unless noted.

| Field | Size | Notes |
|-------|------|--------|
| Preamble | 4 bytes | Always `00 00 00 00` |
| Data Field Length | 4 bytes | Size from Codec ID through Number of Data 2 (exclusive of preamble, length, CRC) |
| Codec ID | 1 byte | Codec 8 = `0x08` |
| Number of Data 1 | 1 byte | Record count `N` |
| AVL Data | variable | `N` AVL records |
| Number of Data 2 | 1 byte | Must equal `N` |
| CRC-16 | 4 bytes | Low 16 bits = CRC; high 16 bits typically `00 00` |

### Total frame size

```text
4 (preamble) + 4 (length) + dataFieldLength + 4 (CRC) = 8 + dataFieldLength + 4
```

Maximum AVL packet size for most devices (including FMB920 class): **1280 bytes**.

---

## 6. AVL record structure (Codec 8)

Each record:

| Field | Size | Notes |
|-------|------|--------|
| Timestamp | 8 bytes | Unix time in **milliseconds** (UTC) |
| Priority | 1 byte | `0` Low, `1` High, `2` Panic |
| GPS Element | 15 bytes | See below |
| IO Element | variable | See below |

### GPS Element (15 bytes)

| Field | Size | Type | Scaling |
|-------|------|------|---------|
| Longitude | 4 | signed int32 | divide by `10_000_000` → degrees |
| Latitude | 4 | signed int32 | divide by `10_000_000` → degrees |
| Altitude | 2 | signed int16 | meters |
| Angle | 2 | unsigned uint16 | degrees from north |
| Satellites | 1 | uint8 | count |
| Speed | 2 | unsigned uint16 | km/h; `0` if GPS invalid |

Negative coordinates use two's complement (MSB of the 32-bit value = 1 means negative).

Official example value `20 9C CA 80` → decimal `547146368` → longitude `54.7146368°`.

### IO Element (Codec 8)

| Field | Size |
|-------|------|
| Event IO ID | 1 byte (AVL ID that triggered event; `0` if not event-driven) |
| N total IO | 1 byte (`N = N1 + N2 + N4 + N8`) |
| N1 (1-byte IO count) | 1 byte |
| N1 × (IO ID 1 + value 1) | variable |
| N2 (2-byte IO count) | 1 byte |
| N2 × (IO ID 1 + value 2) | variable |
| N4 (4-byte IO count) | 1 byte |
| N4 × (IO ID 1 + value 4) | variable |
| N8 (8-byte IO count) | 1 byte |
| N8 × (IO ID 1 + value 8) | variable |

IO IDs are device-specific AVL property IDs (e.g. 239 ignition, 66 external voltage). Values are stored as unsigned integers of the declared width.

---

## 7. CRC validation

- Algorithm: **CRC-16/IBM** (also known as CRC-16/ARC)
  - Polynomial: `0xA001` (reflected form of `0x8005`)
  - Initial value: `0x0000`
  - No final XOR
- Input range: bytes from **Codec ID** through **Number of Data 2** (exactly `Data Field Length` bytes)
- On the wire, CRC is stored in the **low 16 bits** of a 4-byte field (`00 00 XX XX`)

Mismatch → treat packet as invalid; do **not** ACK as accepted records.

---

## 8. AVL acknowledgement

Server → device: **4 bytes**, big-endian unsigned integer = number of AVL records accepted.

| Records accepted | ACK bytes |
|------------------|-----------|
| 1 | `00 00 00 01` |
| 2 | `00 00 00 02` |

If the device's record count and the server ACK do not match, the device resends the packet.

**This project:** ACK only after successful decode **and** successful MongoDB write.

---

## 9. Connection lifecycle

### Accept path

```text
TCP connect
  → IMEI handshake
  → Device.imei found in MongoDB
  → send 0x01
  → loop:
       receive AVL frame
       validate CRC
       decode Codec 8
       insert AvlRecord docs
       send 4-byte ACK = N
  → close / idle timeout
```

### Reject path

```text
TCP connect
  → IMEI handshake
  → Device.imei not found (or malformed)
  → send 0x00
  → close socket
```

---

## 10. Official Codec 8 sample (1 record)

Hex stream (from Teltonika wiki):

```text
000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101425E0F01F10000601A014E0000000000000000010000C7CF
```

| Part | Value |
|------|--------|
| Preamble | `00000000` |
| Data length | `00000036` (54) |
| Codec | `08` |
| Records | `01` |
| Timestamp | `0000016B40D8EA30` → 2019-06-10 10:04:46 UTC |
| Priority | `01` |
| GPS | all zeros in this sample |
| IO | GSM signal, DIN1, external voltage, operator, iButton |
| Number of Data 2 | `01` |
| CRC | `0000C7CF` |
| Expected ACK | `00000001` |

Fixture: `tracker/fixtures/codec8.bin`  
Broken CRC variant: `tracker/fixtures/bad-crc.bin`

---

## 11. Fixtures layout

```text
tracker/fixtures/
  imei.bin       — IMEI handshake for 356307042441013
  codec8.bin     — valid Codec 8 packet (wiki 1st example)
  bad-crc.bin    — same as codec8.bin with CRC byte corrupted
```

Use these for protocol replay and regression tests without a physical device.

---

## 12. What this server does / does not do

**In scope:** TCP listen, IMEI auth via `Device.imei`, framing, CRC, Codec 8 decode, Mongo `AvlRecord`, AVL ACK.

**Out of scope (later):** dashboard APIs, maps, Codec 8 Extended (`0x8E`), Codec 16, GPRS commands (Codec 12).
