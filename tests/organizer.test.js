import path from 'path';
import { jest } from '@jest/globals';
import { FileOrganizer } from '../src/organizer/organizer.js';

const baseConfig = {
  extensionMappings: {
    documents: ['pdf', 'doc', 'docx'],
    pictures: ['jpg', 'png']
  },
  destinationFolders: {
    documents: '/tmp/organized/Documents',
    pictures: '/tmp/organized/Pictures',
    others: '/tmp/organized/Others'
  }
};

function createFakeFs({ statResult = null, renameError = null, mkdirError = null } = {}) {
  return {
    stat: jest.fn(async () => {
      if (statResult instanceof Error) {
        throw statResult;
      }
      return statResult;
    }),
    mkdir: jest.fn(async () => {
      if (mkdirError) {
        throw mkdirError;
      }
      return true;
    }),
    rename: jest.fn(async () => {
      if (renameError) {
        throw renameError;
      }
      return true;
    })
  };
}

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

describe('FileOrganizer', () => {
  test('determineCategory returns configured category for known extension', () => {
    const organizer = new FileOrganizer({ config: baseConfig, logger: createLogger(), fs: createFakeFs({ statResult: { isFile: () => true } }) });

    expect(organizer.determineCategory('/downloads/resume.pdf')).toBe('documents');
    expect(organizer.determineCategory('/downloads/photo.jpg')).toBe('pictures');
    expect(organizer.determineCategory('/downloads/unknown.xyz')).toBe('others');
  });

  test('isTemporaryFile detects partial download files', () => {
    const organizer = new FileOrganizer({ config: baseConfig, logger: createLogger(), fs: createFakeFs({ statResult: { isFile: () => true } }) });

    expect(organizer.isTemporaryFile('/downloads/video.mp4.crdownload')).toBe(true);
    expect(organizer.isTemporaryFile('/downloads/.~lock.document.docx#')).toBe(true);
    expect(organizer.isTemporaryFile('/downloads/report.pdf')).toBe(false);
  });

  test('ensureDestinationExists creates destination folder and returns success', async () => {
    const fakeFs = createFakeFs({ mkdirError: null });
    const organizer = new FileOrganizer({ config: baseConfig, logger: createLogger(), fs: fakeFs });

    const result = await organizer.ensureDestinationExists('documents');

    expect(result).toEqual({ success: true, category: 'documents', destinationFolder: '/tmp/organized/Documents' });
    expect(fakeFs.mkdir).toHaveBeenCalledWith('/tmp/organized/Documents', { recursive: true });
  });

  test('organizeFile ignores temporary files and returns structured ignore result', async () => {
    const fakeFs = createFakeFs({ statResult: { isFile: () => true } });
    const logger = createLogger();
    const organizer = new FileOrganizer({ config: baseConfig, logger, fs: fakeFs });

    const result = await organizer.organizeFile('/downloads/music.mp3.part');

    expect(result).toMatchObject({
      success: false,
      action: 'ignored',
      category: null,
      destination: null,
      status: 'temporary-file'
    });
    expect(logger.info).toHaveBeenCalledWith('Temporary file ignored', expect.objectContaining({ action: 'ignored' }));
  });

  test('organizeFile moves a valid file and returns completed result', async () => {
    const fakeFs = createFakeFs({ statResult: { isFile: () => true } });
    const logger = createLogger();
    const organizer = new FileOrganizer({ config: baseConfig, logger, fs: fakeFs });

    const result = await organizer.organizeFile('/downloads/report.pdf');

    expect(result.success).toBe(true);
    expect(result.action).toBe('moved');
    expect(result.category).toBe('documents');
    expect(result.source).toBe('/downloads/report.pdf');
    expect(result.destination).toBe(path.join('/tmp/organized/Documents', 'report.pdf'));
    expect(result.status).toBe('completed');
    expect(result.timestamp).toEqual(expect.any(String));
    expect(result.durationMs).toEqual(expect.any(Number));

    expect(fakeFs.rename).toHaveBeenCalledWith('/downloads/report.pdf', path.join('/tmp/organized/Documents', 'report.pdf'));
    expect(logger.info).toHaveBeenCalledWith('File moved successfully', expect.objectContaining({ action: 'moved' }));
  });
});
