import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';
import { DuplicateDetector } from '../src/duplicates/duplicate-detector.js';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const crypto = await import('crypto');
const fsWrapper = {
  ...fsPromises,
  createReadStream: fs.createReadStream
};

async function createTempFile(content) {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'duplicate-detector-'));
  const filePath = path.join(tempDir, 'sample.txt');
  await fsPromises.writeFile(filePath, content, 'utf8');
  return { tempDir, filePath };
}

describe('DuplicateDetector', () => {
  let tempDirectory;
  let filesToCleanup = [];

  afterEach(async () => {
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();

    for (const filePath of filesToCleanup) {
      try {
        await fsPromises.rm(filePath, { recursive: true, force: true });
      } catch {}
    }
    filesToCleanup = [];
  });

  test('calculateHash returns a SHA-256 hash for a file', async () => {
    const { tempDir, filePath } = await createTempFile('hello world');
    filesToCleanup.push(tempDir);

    const detector = new DuplicateDetector({ fs: fsWrapper, crypto, logger });
    const result = await detector.calculateHash(filePath);

    expect(result).toEqual({
      success: true,
      source: filePath,
      hash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    expect(logger.info).toHaveBeenCalledWith('Calculated SHA-256 hash', expect.objectContaining({ action: 'calculateHash', source: filePath, hash: result.hash }));
  });

  test('calculateHash returns structured error for missing file', async () => {
    const detector = new DuplicateDetector({ fs: fsWrapper, crypto, logger });
    const result = await detector.calculateHash('/nonexistent/file.txt');

    expect(result.success).toBe(false);
    expect(result.error).toHaveProperty('message');
    expect(result.source).toBe('/nonexistent/file.txt');
    expect(logger.error).toHaveBeenCalledWith('Failed to calculate hash', expect.objectContaining({ action: 'calculateHash', source: '/nonexistent/file.txt' }));
  });

  test('isDuplicate returns true when a matching file exists', async () => {
    const { tempDir, filePath: sourceFile } = await createTempFile('duplicate content');
    filesToCleanup.push(tempDir);

    const destinationDir = path.join(tempDir, 'destination');
    await fsPromises.mkdir(destinationDir, { recursive: true });
    const destinationFile = path.join(destinationDir, 'copy.txt');
    await fsPromises.writeFile(destinationFile, 'duplicate content', 'utf8');

    const detector = new DuplicateDetector({ fs: fsWrapper, crypto, logger });
    const result = await detector.isDuplicate(sourceFile, destinationDir);

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.match).toBe(destinationFile);
    expect(logger.info).toHaveBeenCalledWith('Duplicate file detected', expect.objectContaining({ action: 'isDuplicate', duplicate: true, source: sourceFile, destinationDirectory: destinationDir, match: destinationFile }));
  });

  test('isDuplicate returns false when no matching file exists', async () => {
    const { tempDir, filePath: sourceFile } = await createTempFile('unique content');
    filesToCleanup.push(tempDir);

    const destinationDir = path.join(tempDir, 'destination');
    await fsPromises.mkdir(destinationDir, { recursive: true });
    await fsPromises.writeFile(path.join(destinationDir, 'other.txt'), 'different content', 'utf8');

    const detector = new DuplicateDetector({ fs: fsWrapper, crypto, logger });
    const result = await detector.isDuplicate(sourceFile, destinationDir);

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result).not.toHaveProperty('match');
    expect(logger.info).toHaveBeenCalledWith('No duplicate found', expect.objectContaining({ action: 'isDuplicate', duplicate: false, source: sourceFile, destinationDirectory: destinationDir }));
  });

  test('isDuplicate returns structured error for invalid destination directory', async () => {
    const { tempDir, filePath: sourceFile } = await createTempFile('some content');
    filesToCleanup.push(tempDir);

    const detector = new DuplicateDetector({ fs: fsWrapper, crypto, logger });
    const result = await detector.isDuplicate(sourceFile, path.join(tempDir, 'missing-dir'));

    expect(result.success).toBe(false);
    expect(result.duplicate).toBe(false);
    expect(result.error).toHaveProperty('message');
    expect(logger.error).toHaveBeenCalledWith('Duplicate detection failed', expect.objectContaining({ action: 'isDuplicate', duplicate: false, source: sourceFile, destinationDirectory: path.join(tempDir, 'missing-dir') }));
  });
});
