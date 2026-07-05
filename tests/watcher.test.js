import path from 'path';
import { jest } from '@jest/globals';
import { FileWatcher } from '../src/watcher/file-watcher.js';

function createFakeWatcher() {
  const handlers = {};
  return {
    on: (evt, cb) => { handlers[evt] = cb; },
    emit: (evt, ...args) => { if (handlers[evt]) handlers[evt](...args); },
    close: jest.fn(async () => true),
    _handlers: handlers
  };
}

describe('FileWatcher', () => {
  const baseConfig = { watchFolder: '/downloads', watcher: { stabilityThresholdMs: 10, pollIntervalMs: 5, recentTTLMs: 100 } };
  let logger;
  let organizer;

  beforeEach(() => {
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    organizer = { organizeFile: jest.fn(async (p) => ({ success: true, source: p })) };
  });

  test('start registers add handler and uses chokidar factory', async () => {
    const fakeWatcher = createFakeWatcher();
    const chokidarFactory = jest.fn(() => fakeWatcher);

    const watcher = new FileWatcher({ config: baseConfig, logger, organizer, chokidar: { watch: chokidarFactory } });
    watcher.start();

    expect(typeof fakeWatcher.on).toBe('function');
    // simulate add
    fakeWatcher.emit('add', '/downloads/file.txt');

    // organizer called
    expect(organizer.organizeFile).toHaveBeenCalledWith('/downloads/file.txt');
  });

  test('ignores temporary files', async () => {
    const fakeWatcher = createFakeWatcher();
    const chokidarFactory = jest.fn(() => fakeWatcher);
    const watcher = new FileWatcher({ config: baseConfig, logger, organizer, chokidar: { watch: chokidarFactory } });
    watcher.start();

    fakeWatcher.emit('add', '/downloads/video.mp4.crdownload');
    expect(organizer.organizeFile).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Ignored temporary file', expect.objectContaining({ action: 'watcher:ignore' }));
  });

  test('prevents duplicate processing for quick successive events', async () => {
    const fakeWatcher = createFakeWatcher();
    const chokidarFactory = jest.fn(() => fakeWatcher);
    const longOrganizer = { organizeFile: jest.fn(() => new Promise((res) => setTimeout(() => res({ success: true }), 50))) };

    const watcher = new FileWatcher({ config: baseConfig, logger, organizer: longOrganizer, chokidar: { watch: chokidarFactory } });
    watcher.start();

    fakeWatcher.emit('add', '/downloads/doc.pdf');
    fakeWatcher.emit('add', '/downloads/doc.pdf');

    // wait for organizer to complete
    await new Promise((r) => setTimeout(r, 120));
    expect(longOrganizer.organizeFile).toHaveBeenCalledTimes(1);
  });

  test('stop closes watcher and prevents further processing', async () => {
    const fakeWatcher = createFakeWatcher();
    const chokidarFactory = jest.fn(() => fakeWatcher);
    const watcher = new FileWatcher({ config: baseConfig, logger, organizer, chokidar: { watch: chokidarFactory } });
    watcher.start();

    await watcher.stop();
    expect(fakeWatcher.close).toHaveBeenCalled();

    // after stop, emit should not trigger organize
    fakeWatcher.emit('add', '/downloads/after-stop.txt');
    expect(organizer.organizeFile).not.toHaveBeenCalledWith('/downloads/after-stop.txt');
  });
});
