import path from 'path';

export class DuplicateDetector {
  constructor({ fs, crypto, logger }) {
    if (!fs || typeof fs.createReadStream !== 'function' || typeof fs.readdir !== 'function' || typeof fs.stat !== 'function') {
      throw new Error('DuplicateDetector requires a file system abstraction with createReadStream, readdir, and stat.');
    }

    if (!crypto || typeof crypto.createHash !== 'function') {
      throw new Error('DuplicateDetector requires a crypto abstraction with createHash.');
    }

    this.fs = fs;
    this.crypto = crypto;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  async calculateHash(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        error: { message: 'File path must be a non-empty string.' },
        source: filePath
      };
    }

    const hash = this.crypto.createHash('sha256');

    try {
      const stats = await this.fs.stat(filePath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: { message: 'Path is not a file.' },
          source: filePath
        };
      }

      await new Promise((resolve, reject) => {
        const stream = this.fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const digest = hash.digest('hex');
      const result = { success: true, source: filePath, hash: digest };
      this.logger.info('Calculated SHA-256 hash', { action: 'calculateHash', ...result });
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: { message: error.message, code: error.code },
        source: filePath
      };
      this.logger.error('Failed to calculate hash', { action: 'calculateHash', ...result });
      return result;
    }
  }

  async isDuplicate(sourceFile, destinationDirectory) {
    const sourceHashResult = await this.calculateHash(sourceFile);
    if (!sourceHashResult.success) {
      return {
        success: false,
        duplicate: false,
        source: sourceFile,
        destinationDirectory,
        error: sourceHashResult.error
      };
    }

    try {
      const entries = await this.fs.readdir(destinationDirectory);
      if (!Array.isArray(entries)) {
        throw new Error('Destination directory could not be read.');
      }

      for (const entry of entries) {
        const candidatePath = path.join(destinationDirectory, entry);
        try {
          const stats = await this.fs.stat(candidatePath);
          if (!stats.isFile()) {
            continue;
          }
        } catch {
          continue;
        }

        const candidateHashResult = await this.calculateHash(candidatePath);
        if (!candidateHashResult.success) {
          continue;
        }

        if (candidateHashResult.hash === sourceHashResult.hash) {
          const result = {
            success: true,
            duplicate: true,
            source: sourceFile,
            destinationDirectory,
            match: candidatePath
          };
          this.logger.info('Duplicate file detected', { action: 'isDuplicate', ...result });
          return result;
        }
      }

      const result = {
        success: true,
        duplicate: false,
        source: sourceFile,
        destinationDirectory
      };
      this.logger.info('No duplicate found', { action: 'isDuplicate', ...result });
      return result;
    } catch (error) {
      const result = {
        success: false,
        duplicate: false,
        source: sourceFile,
        destinationDirectory,
        error: { message: error.message, code: error.code }
      };
      this.logger.error('Duplicate detection failed', { action: 'isDuplicate', ...result });
      return result;
    }
  }
}
