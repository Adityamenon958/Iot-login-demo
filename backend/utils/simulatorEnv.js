/**
 * Simulator availability: on by default on Azure App Service, off locally.
 *
 * Priority:
 *   ENABLE_SIMULATOR=true  → always on (local override)
 *   ENABLE_SIMULATOR=false → always off (Azure override)
 *   WEBSITE_SITE_NAME set  → on (Azure App Service auto-env)
 *   otherwise              → off (local dev)
 */

function resolveSimulatorEnabled() {
  const flag = process.env.ENABLE_SIMULATOR;

  if (flag === 'true') {
    return { enabled: true, reason: 'ENABLE_SIMULATOR=true' };
  }
  if (flag === 'false') {
    return { enabled: false, reason: 'ENABLE_SIMULATOR=false' };
  }

  const azureSite = process.env.WEBSITE_SITE_NAME;
  if (azureSite) {
    return { enabled: true, reason: `Azure App Service (${azureSite})` };
  }

  return {
    enabled: false,
    reason: 'local development (set ENABLE_SIMULATOR=true in .env to enable)',
  };
}

const simulatorEnv = resolveSimulatorEnabled();
const ENABLE_SIMULATOR = simulatorEnv.enabled;

module.exports = {
  ENABLE_SIMULATOR,
  resolveSimulatorEnabled,
};
