import { loadConfig } from './config/config-loader.js';
import { initializeLogger } from './logger/logger.js';

async function main() {
  const config = await loadConfig();
  const logger = await initializeLogger(config.logging);

  logger.info('Smart File Organizer started', {
    action: 'application:start',
    watchFolder: config.watchFolder,
    previewMode: config.previewMode
  });

  console.log('Smart File Organizer started with config:', config);
}

main().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
