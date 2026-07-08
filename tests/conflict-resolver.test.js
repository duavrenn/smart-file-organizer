import { jest } from '@jest/globals';
import path from 'path';
import { ConflictResolver } from '../src/conflict/conflict-resolver.js';

function createFakeFs(existing = new Set(), statError = null) {
  return {
    stat: jest.fn(async (p) => {
      if (statError) throw statError;
      if (existing.has(p)) return { isFile: () => true };
      const err = new Error('Not found');
      err.code = 'ENOENT';
      throw err;
    })
  };
}

describe('ConflictResolver', () => {
  test('returns original when destination does not exist', async () => {
    const fakeFs = createFakeFs(new Set());
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp', 'file.txt');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(true);
    expect(res.resolvedPath).toBe(dest);
    expect(res.conflictResolved).toBe(false);
  });

  test('resolves single filename conflict', async () => {
    const existing = new Set([path.join('/tmp', 'file.txt')]);
    const fakeFs = createFakeFs(existing);
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp', 'file.txt');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(true);
    expect(res.conflictResolved).toBe(true);
    expect(res.resolvedPath).toBe(path.join('/tmp', 'file (1).txt'));
  });

  test('resolves multiple filename conflicts', async () => {
    const existing = new Set([
      path.join('/tmp', 'file.txt'),
      path.join('/tmp', 'file (1).txt'),
      path.join('/tmp', 'file (2).txt')
    ]);
    const fakeFs = createFakeFs(existing);
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp', 'file.txt');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(true);
    expect(res.conflictResolved).toBe(true);
    expect(res.resolvedPath).toBe(path.join('/tmp', 'file (3).txt'));
  });

  test('handles files without extensions', async () => {
    const existing = new Set([path.join('/tmp', 'README')]);
    const fakeFs = createFakeFs(existing);
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp', 'README');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(true);
    expect(res.conflictResolved).toBe(true);
    expect(res.resolvedPath).toBe(path.join('/tmp', 'README (1)'));
  });

  test('handles hidden files', async () => {
    const existing = new Set([path.join('/tmp', '.env')]);
    const fakeFs = createFakeFs(existing);
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp', '.env');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(true);
    expect(res.conflictResolved).toBe(true);
    expect(res.resolvedPath).toBe(path.join('/tmp', '.env (1)'));
  });

  test('nested destination directories', async () => {
    const existing = new Set([path.join('/tmp/sub', 'file.txt')]);
    const fakeFs = createFakeFs(existing);
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp/sub', 'file.txt');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(true);
    expect(res.resolvedPath).toBe(path.join('/tmp/sub', 'file (1).txt'));
  });

  test('filesystem errors return structured failure', async () => {
    const fakeFs = createFakeFs(new Set(), new Error('EACCESS'));
    const resolver = new ConflictResolver({ fs: fakeFs, pathLib: path });

    const dest = path.join('/tmp', 'file.txt');
    const res = await resolver.resolve(dest);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
