import path from 'path';

const TEMP_EXTENSIONS = ['.crdownload', '.part', '.tmp', '.download', '.partial'];

export class FileWatcher {
  constructor({ config, logger, organizer, chokidar: chokidarLib } = {}) {
    if (!config) throw new Error('FileWatcher requires a config object');
    if (!logger) throw new Error('FileWatcher requires a logger');
    if (!organizer) throw new Error('FileWatcher requires a FileOrganizer');

    this.config = config;
    this.logger = logger;
    this.organizer = organizer;
    this.chokidar = chokidarLib; // optional injection for tests

    this.watcher = null;
    this._processing = new Set();
    this._recent = new Map();
    this._recentTTL = (config?.watcher?.recentTTLMs) ?? 60000; // default 60s
    this._disposed = false;
  }

  async start() {
    if (this.watcher) return;

    const watchPath = this.config.watchFolder;
    const chokidar = this.chokidar || await awaitChokidarImport();

    const ignorePattern = (p) => {
      const lower = String(p).toLowerCase();
      return TEMP_EXTENSIONS.some((ext) => lower.endsWith(ext));
    };

    const options = {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: {
        stabilityThreshold: (this.config?.watcher?.stabilityThresholdMs) ?? 2000,
        pollInterval: (this.config?.watcher?.pollIntervalMs) ?? 100
      },
      ignored: (p) => {
        // ignore temporary files
        return ignorePattern(p);
      }
    };

    this.logger.info('Starting file watcher', { action: 'watcher:start', watchPath });
    this.watcher = chokidar.watch(watchPath, options);

    this.watcher.on('add', (filePath) => this._onAdd(filePath));
    this.watcher.on('error', (err) => this.logger.error('Watcher error', { action: 'watcher:error', error: err }));
  }

  async stop() {
    this._disposed = true;
    if (this.watcher && typeof this.watcher.close === 'function') {
      try {
        await this.watcher.close();
        this.logger.info('File watcher stopped', { action: 'watcher:stop' });
      } catch (err) {
        this.logger.warn('Error stopping watcher', { action: 'watcher:stop', error: err });
      }
    }

    // clear recent map
    this._recent.clear();
    this._processing.clear();
  }

  _isTemporary(filePath) {
    const ext = path.extname(String(filePath)).toLowerCase();
    const base = path.basename(String(filePath)).toLowerCase();
    if (TEMP_EXTENSIONS.includes(ext)) return true;
    // additional patterns
    if (base.startsWith('~$') || base.startsWith('.~lock')) return true;
    return false;
  }

  async _onAdd(filePath) {
    if (this._disposed) return;
    try {
      if (this._isTemporary(filePath)) {
        this.logger.info('Ignored temporary file', { action: 'watcher:ignore', source: filePath });
        return;
      }

      if (this._recent.has(filePath)) {
        this.logger.info('Skipping recently processed file', { action: 'watcher:skip:recent', source: filePath });
        return;
      }

      if (this._processing.has(filePath)) {
        this.logger.info('Skipping already processing file', { action: 'watcher:skip:processing', source: filePath });
        return;
      }

      this._processing.add(filePath);
      this.logger.info('Dispatching file to organizer', { action: 'watcher:dispatch', source: filePath });

      // call organizer (it returns a structured result)
      const result = await this.organizer.organizeFile(filePath);

      // mark recently processed for TTL
      this._recent.set(filePath, Date.now());
      setTimeout(() => this._recent.delete(filePath), this._recentTTL);

      this.logger.info('Watcher processed file', { action: 'watcher:processed', source: filePath, result });
    } catch (error) {
      this.logger.error('Watcher dispatch error', { action: 'watcher:dispatch:error', source: filePath, error });
    } finally {
      this._processing.delete(filePath);
    }
  }
}

function awaitChokidarImport() {
  // dynamic import to keep testability and avoid static dependency in mocks
  return import('chokidar').then((m) => m.default || m);
}
