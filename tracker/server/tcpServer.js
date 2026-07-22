const net = require('net');
const { ConnectionSession } = require('../session/connectionSession');

function createStats() {
  return {
    connections: 0,
    activeConnections: 0,
    authOk: 0,
    authFails: 0,
    crcOk: 0,
    crcFails: 0,
    framingErrors: 0,
    decodeFails: 0,
    recordsWritten: 0,
    writeFails: 0,
    acksSent: 0,
    bytesReceived: 0,
    bufferOverflows: 0,
    rejectedMaxConn: 0,
    sessionErrors: 0,
  };
}

/**
 * Start Teltonika TCP listener.
 * @returns {{ server: import('net').Server, stats: object, close: Function }}
 */
function startTcpServer(config) {
  const stats = createStats();
  const sessions = new Set();

  const server = net.createServer((socket) => {
    if (stats.activeConnections >= config.maxConnections) {
      stats.rejectedMaxConn += 1;
      console.warn(
        `[tracker] rejecting connection (max ${config.maxConnections}): ${socket.remoteAddress}:${socket.remotePort}`
      );
      socket.destroy();
      return;
    }

    stats.connections += 1;
    stats.activeConnections += 1;
    console.log(`[tracker] connection from ${socket.remoteAddress}:${socket.remotePort}`);

    socket.setKeepAlive(true, 30_000);
    socket.setNoDelay(true);

    const session = new ConnectionSession(socket, {
      config,
      stats,
      onClose: () => {
        sessions.delete(session);
        stats.activeConnections = Math.max(0, stats.activeConnections - 1);
      },
    });
    sessions.add(session);

    socket.on('data', (chunk) => session.onData(chunk));
    socket.on('error', (err) => {
      console.error(`[tracker] socket error ${session.remote}:`, err.message);
      session.close('socket error');
    });
    socket.on('close', () => {
      session.close('peer closed');
    });
  });

  server.on('error', (err) => {
    console.error('[tracker] TCP server error:', err.message);
  });

  server.listen(config.port, config.host, () => {
    console.log(`[tracker] listening on ${config.host}:${config.port}`);
  });

  // Periodic console summary (Phase 9 hardening visibility)
  const summaryTimer = setInterval(() => {
    console.log('[tracker] stats', JSON.stringify(stats));
  }, 60_000);
  if (typeof summaryTimer.unref === 'function') summaryTimer.unref();

  const close = () =>
    new Promise((resolve) => {
      clearInterval(summaryTimer);
      for (const session of sessions) {
        session.close('shutdown');
      }
      server.close(() => resolve());
    });

  return { server, stats, close };
}

module.exports = {
  startTcpServer,
  createStats,
};
