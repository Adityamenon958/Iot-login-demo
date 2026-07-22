/**
 * Tracker TCP process entry.
 * Separate from Express (server.js). Shares Mongo via backend/db.js.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../backend/db');
const config = require('./config');
const { startTcpServer } = require('./server/tcpServer');

async function main() {
  console.log('[tracker] starting…');
  console.log(
    `[tracker] config port=${config.port} host=${config.host} idleTimeoutMs=${config.idleTimeoutMs} maxConnections=${config.maxConnections}`
  );

  if (!config.mongoUri) {
    console.error('[tracker] MONGO_URI is not set — cannot authenticate IMEIs or persist AVL');
    process.exit(1);
  }

  await connectDB();
  console.log('[tracker] MongoDB ready');

  // Ensure models are registered
  require('../backend/models/Device');
  require('../backend/models/AvlRecord');

  const { close, stats } = startTcpServer(config);

  const shutdown = async (signal) => {
    console.log(`[tracker] ${signal} received — shutting down`);
    console.log('[tracker] final stats', JSON.stringify(stats));
    try {
      await close();
    } catch (err) {
      console.error('[tracker] close error:', err.message);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[tracker] fatal:', err);
  process.exit(1);
});
