# Tracker TCP server — Azure Linux VM notes

This process is separate from Azure App Service (`node server.js`).

## Run

```bash
cd /path/to/Iot-login-demo
export MONGO_URI="..."
export TRACKER_TCP_PORT=5027
# optional:
# export TRACKER_IDLE_TIMEOUT_MS=120000
# export TRACKER_MAX_CONNECTIONS=200
# export TRACKER_STORE_RAW_HEX=false
npm run start:tracker
```

## Process manager (example systemd)

```ini
[Unit]
Description=IoT Teltonika Tracker TCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/Iot-login-demo
EnvironmentFile=/opt/Iot-login-demo/.env
ExecStart=/usr/bin/node tracker/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Firewall / NSG

Open inbound TCP on `TRACKER_TCP_PORT` (default 5027) to the VM.

Configure the FMB920 GPRS domain/IP and port to this VM.

## App Service

Do **not** run the tracker on App Service. Keep `npm start` → `node server.js` only.
