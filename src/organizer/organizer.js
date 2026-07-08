import path from 'path';

const TEMPORARY_EXTENSIONS = new Set(['.crdownload', '.part', '.tmp', '.partial', '.temp']);
const TEMPORARY_NAME_PATTERNS = [/^~\$.*$/, /^\.~lock\..*#$/, /^\.ds_store$/];

export class FileOrganizer {
  constructor({ config, logger, fs, conflictResolver } = {}) {
    if (!config || typeof config !== 'object') {
      throw new Error('FileOrganizer requires a config object.');
    }

    this.config = config;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.fs = fs;
    this.conflictResolver = conflictResolver || { resolve: async (p) => ({ success: true, originalPath: p, resolvedPath: p, conflictResolved: false }) };

    if (!this.fs || typeof this.fs.stat !== 'function' || typeof this.fs.rename !== 'function') {
      throw new Error('FileOrganizer requires a file system abstraction with stat and rename methods.');
    }
    if (typeof this.conflictResolver.resolve !== 'function') {
      throw new Error('FileOrganizer requires a conflictResolver with a resolve(destinationPath) method.');
    }
  }

  async organizeFile(filePath) {
    const timestamp = new Date().toISOString();
    const normalizedPath = String(filePath);

    const validation = await this.validateFile(normalizedPath);
    if (!validation.success) {
      this.logger.warn('File validation failed', { action: 'organizeFile:validate', source: normalizedPath, ...validation });
      return { timestamp, ...validation, action: 'validate' };
    }

    if (this.isTemporaryFile(normalizedPath)) {
      const result = {
        success: false,
        action: 'ignored',
        category: null,
        source: normalizedPath,
        destination: null,
        status: 'temporary-file',
        timestamp
      };
      this.logger.info('Temporary file ignored', result);
      return result;
    }

    const category = this.determineCategory(normalizedPath);
    const destinationResult = await this.ensureDestinationExists(category);
    if (!destinationResult.success) {
      return { timestamp, action: 'ensureDestination', category, source: normalizedPath, destination: null, status: 'failed', ...destinationResult };
    }

    const destination = this.getDestinationPath(normalizedPath, category);

    // TODO: integrate duplicate detector before moving the file.
    // Resolve filename conflicts before moving
    const resolved = await this.conflictResolver.resolve(destination);
    const finalDestination = resolved && resolved.success ? resolved.resolvedPath : destination;

    const moveResult = await this.moveFile(normalizedPath, finalDestination);

    if (!moveResult.success) {
      return {
        timestamp,
        action: moveResult.action,
        category,
        source: normalizedPath,
        destination,
        status: 'failed',
        error: moveResult.error
      };
    }

    const result = {
      success: true,
      action: 'moved',
      category,
      source: normalizedPath,
      destination,
      status: 'completed',
      timestamp,
      durationMs: moveResult.durationMs
    };

    this.logger.info('File moved successfully', result);

    // TODO: notify history service about completed move.
    return result;
  }

  determineCategory(filePath) {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    const mappings = this.config.extensionMappings || {};

    for (const [category, extensions] of Object.entries(mappings)) {
      if (Array.isArray(extensions) && extensions.includes(extension)) {
        return category;
      }
    }

    return 'others';
  }

  async ensureDestinationExists(category) {
    const normalizedCategory = this._normalizeCategoryKey(category);
    const destinationFolder = this.config.destinationFolders?.[normalizedCategory];

    if (!destinationFolder) {
      const error = { message: `Destination folder for category '${category}' is not configured.` };
      this.logger.error('Missing destination folder', { action: 'ensureDestinationExists', category, error });
      return { success: false, error };
    }

    try {
      await this.fs.mkdir(destinationFolder, { recursive: true });
      return { success: true, category: normalizedCategory, destinationFolder };
    } catch (error) {
      this.logger.error('Failed to create destination folder', { action: 'ensureDestinationExists', category, destinationFolder, error });
      return { success: false, error: { message: error.message, code: error.code } };
    }
  }

  async moveFile(source, destination) {
    const start = Date.now();

    // TODO: integrate conflict resolver before attempting a rename.
    try {
      await this.fs.rename(source, destination);
      return { success: true, action: 'moved', destination, durationMs: Date.now() - start };
    } catch (error) {
      this.logger.warn('File move failed', { action: 'moveFile', source, destination, error });

      const duplicateOrConflict = error.code === 'EEXIST' || error.code === 'EPERM';
      return {
        success: false,
        action: duplicateOrConflict ? 'conflict' : 'failed',
        error: { message: error.message, code: error.code }
      };
    }
  }

  isTemporaryFile(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    const extension = path.extname(fileName);

    if (TEMPORARY_EXTENSIONS.has(extension)) {
      return true;
    }

    return TEMPORARY_NAME_PATTERNS.some((pattern) => pattern.test(fileName));
  }

  getDestinationPath(filePath, category) {
    const normalizedCategory = this._normalizeCategoryKey(category);
    const destinationFolder = this.config.destinationFolders?.[normalizedCategory] || this.config.destinationFolders?.others;
    const fileName = path.basename(filePath);
    return path.join(destinationFolder, fileName);
  }

  async validateFile(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: { message: 'File path must be a non-empty string.' } };
    }

    try {
      const stats = await this.fs.stat(filePath);
      if (!stats.isFile()) {
        return { success: false, error: { message: 'Path is not a file.' } };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: { message: `Unable to access file: ${error.message}`, code: error.code } };
    }
  }

  _normalizeCategoryKey(category) {
    return String(category || 'others').toLowerCase();
  }
}
