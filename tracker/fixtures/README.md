# Binary fixtures for Teltonika protocol replay / regression

| File | Description |
|------|-------------|
| `imei.bin` | IMEI handshake for `356307042441013` (`000F` + ASCII) |
| `codec8.bin` | Official Codec 8 sample (1 record, CRC `C7CF`) from Teltonika wiki |
| `bad-crc.bin` | Same as `codec8.bin` with last CRC byte flipped |

Source of truth for field meanings: `../docs/teltonika-protocol.md`
