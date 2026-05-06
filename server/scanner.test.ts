import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanDirectory } from './scanner';

let tmpDir: string;

async function makeTempTree() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overdisk-test-'));

  // Structure:
  // tmpDir/
  //   big.txt      (1000 bytes)
  //   small.txt    (100 bytes)
  //   subdir/
  //     nested.txt (500 bytes)
  //     deep/
  //       deep.txt (200 bytes)
  //   empty/

  await fs.writeFile(path.join(tmpDir, 'big.txt'), 'x'.repeat(1000));
  await fs.writeFile(path.join(tmpDir, 'small.txt'), 'y'.repeat(100));

  const subdir = path.join(tmpDir, 'subdir');
  await fs.mkdir(subdir);
  await fs.writeFile(path.join(subdir, 'nested.txt'), 'z'.repeat(500));

  const deep = path.join(subdir, 'deep');
  await fs.mkdir(deep);
  await fs.writeFile(path.join(deep, 'deep.txt'), 'w'.repeat(200));

  const empty = path.join(tmpDir, 'empty');
  await fs.mkdir(empty);
}

beforeEach(async () => {
  await makeTempTree();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('scanDirectory', () => {
  it('returns the correct root name', async () => {
    const result = await scanDirectory(tmpDir);
    expect(result.name).toBe(path.basename(tmpDir));
  });

  it('calculates total size correctly', async () => {
    const result = await scanDirectory(tmpDir);
    // 1000 + 100 + 500 + 200 = 1800
    expect(result.size).toBe(1800);
  });

  it('counts files correctly', async () => {
    const result = await scanDirectory(tmpDir);
    expect(result.fileCount).toBe(4);
  });

  it('counts directories correctly', async () => {
    const result = await scanDirectory(tmpDir);
    // subdir, subdir/deep, empty = 3
    expect(result.dirCount).toBe(3);
  });

  it('sorts children by size descending', async () => {
    const result = await scanDirectory(tmpDir);
    expect(result.children).toBeDefined();
    const names = result.children!.map((c) => c.name);
    // subdir (700) > empty (0), but files are not children in the tree
    // children are: subdir, empty (dirs only appear in children)
    // Actually children includes both dirs — let's just check sort order
    const sizes = result.children!.map((c) => c.size);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    }
  });

  it('handles nested directories', async () => {
    const result = await scanDirectory(tmpDir);
    const subdir = result.children!.find((c) => c.name === 'subdir');
    expect(subdir).toBeDefined();
    expect(subdir!.size).toBe(700); // 500 + 200
    expect(subdir!.fileCount).toBe(2);
    expect(subdir!.dirCount).toBe(1); // deep
  });

  it('handles empty directories', async () => {
    const result = await scanDirectory(tmpDir);
    const empty = result.children!.find((c) => c.name === 'empty');
    expect(empty).toBeDefined();
    expect(empty!.size).toBe(0);
    expect(empty!.fileCount).toBe(0);
    expect(empty!.children).toBeUndefined();
  });

  it('returns empty node for inaccessible paths', async () => {
    const result = await scanDirectory(path.join(tmpDir, 'nonexistent'));
    expect(result.name).toBe('nonexistent');
    expect(result.size).toBe(0);
    expect(result.fileCount).toBe(0);
  });

  it('calls progress callback', async () => {
    // Create enough files to trigger the progress callback (every 500 items)
    const bulkDir = path.join(tmpDir, 'bulk');
    await fs.mkdir(bulkDir);
    const writes = [];
    for (let i = 0; i < 510; i++) {
      writes.push(fs.writeFile(path.join(bulkDir, `f${i}.txt`), 'a'));
    }
    await Promise.all(writes);

    const onProgress = vi.fn();
    await scanDirectory(tmpDir, onProgress);
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(500);
  });
});
