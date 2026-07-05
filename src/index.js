import path from 'path';
import fsPromises from 'fs/promises';
import fs from 'fs';
import crypto from 'crypto';

import { loadConfig } from './config/config-loader.js';
import { initializeLogger } from './logger/logger.js';
import { DuplicateDetector } from './duplicates/duplicate-detector.js';
import { FileOrganizer } from './organizer/organizer.js';
import { FileWatcher } from './watcher/file-watcher.js';

let logger;
let watcher;

async function loadPackageVersion() {
  try {
    const data = await fsPromises.readFile(path.resolve(process.cwd(), 'package.json'), 'utf8');
    const pkg = JSON.parse(data);
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main() {
  const version = await loadPackageVersion();
  const config = await loadConfig();

  logger = await initializeLogger(config.logging);

  // Initialize DuplicateDetector
  const fsWrapper = { ...fsPromises, createReadStream: fs.createReadStream };
  const duplicateDetector = new DuplicateDetector({ fs: fsWrapper, crypto, logger });

  // Initialize Organizer
  const organizer = new FileOrganizer({ config, logger, fs: fsPromises });

  // Initialize Watcher
  watcher = new FileWatcher({ config, logger, organizer });
  watcher.start();

  const summary = [
    '------------------------------------------------',
    `Smart File Organizer v${version}`,
    '',
    '✓ Configuration loaded',
    '✓ Logger initialized',
    '✓ Duplicate detector initialized',
    '✓ Organizer initialized',
    '✓ File watcher started',
    '',
    'Watching:',
    config.watchFolder,
    '',
    'Ready to organize files.',
    '------------------------------------------------'
  ].join('\n');

  console.log(summary);
  logger.info('Application started', { action: 'application:start', watchFolder: config.watchFolder });

  // Graceful shutdown
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown signal received', { action: 'application:shutdown', signal });
    try {
      if (watcher && typeof watcher.stop === 'function') {
        await watcher.stop();
      }
    } catch (err) {
      logger.warn('Error during watcher stop', { action: 'application:shutdown', error: err });
    }

    try {
      logger.info('Flushing logs and closing logger');
      if (typeof logger.close === 'function') {
        logger.close();
      }
    } catch (err) {
      // ignore
    }

    // allow some time for transports to flush
    setTimeout(() => process.exit(0), 200);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  // If logger is available, use it, otherwise console
  if (logger && typeof logger.error === 'function') {
    logger.error('Failed to start application', { action: 'application:start:error', error });
  } else {
    console.error('Failed to start application', error);
  }
  process.exit(1);
});
