import path from 'path';

export class ConflictResolver {
  constructor({ fs, pathLib = path, logger } = {}) {
    if (!fs || typeof fs.stat !== 'function') {
      throw new Error('ConflictResolver requires a fs/promises-like object with stat method.');
    }
    if (!pathLib) throw new Error('ConflictResolver requires path module');
    this.fs = fs;
    this.path = pathLib;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  async resolve(destinationPath) {
    const originalPath = destinationPath;
    try {
      // if file doesn't exist, return original
      try {
        const stats = await this.fs.stat(destinationPath);
        if (!stats.isFile()) {
          // exists but not a file, treat as conflict
        }
      } catch (err) {
        if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
          return { success: true, originalPath, resolvedPath: originalPath, conflictResolved: false };
        }
        // other errors fall through
      }

      const dir = this.path.dirname(originalPath);
      const base = this.path.basename(originalPath);
      const ext = this.path.extname(base);
      const name = base.slice(0, base.length - ext.length);

      // try name (n), name (1), name (2), ...
      let index = 1;
      let candidate;
      while (true) {
        candidate = this.path.join(dir, `${name} (${index})${ext}`);
        try {
          await this.fs.stat(candidate);
          // exists, bump index
          index += 1;
          continue;
        } catch (err) {
          if (err && err.code === 'ENOENT') {
            // candidate does not exist -> use it
            return { success: true, originalPath, resolvedPath: candidate, conflictResolved: true };
          }
          // unexpected error
          throw err;
        }
      }
    } catch (error) {
      this.logger.error('ConflictResolver failed', { action: 'conflict:resolve', destinationPath, error });
      return { success: false, originalPath, resolvedPath: destinationPath, conflictResolved: false, error: { message: error.message, code: error.code } };
    }
  }
}
