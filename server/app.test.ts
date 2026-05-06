import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { app } from './app';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overdisk-api-'));
  await fs.writeFile(path.join(tmpDir, 'test.txt'), 'hello world');
  const sub = path.join(tmpDir, 'sub');
  await fs.mkdir(sub);
  await fs.writeFile(path.join(sub, 'nested.txt'), 'nested content');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/drives', () => {
  it('returns an array of drive letters', async () => {
    const res = await request(app).get('/api/drives');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // On Windows there's at least C:\
    if (process.platform === 'win32') {
      expect(res.body).toContain('C:\\');
    }
  });
});

describe('GET /api/scan', () => {
  it('returns 400 when path is missing', async () => {
    const res = await request(app).get('/api/scan');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 400 for non-existent path', async () => {
    const res = await request(app).get('/api/scan').query({ path: '/no/such/dir/ever' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not accessible|not exist/i);
  });

  it('returns 400 when path is a file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const res = await request(app).get('/api/scan').query({ path: filePath });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a directory/i);
  });

  it('streams SSE events for a valid directory', async () => {
    const res = await request(app)
      .get('/api/scan')
      .query({ path: tmpDir })
      .buffer(true)
      .parse((res, callback) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => { callback(null, data); });
      });

    expect(res.status).toBe(200);
    const body = res.body as string;

    // Should contain at least a "done" event
    expect(body).toContain('"type":"done"');

    // Parse the done event
    const lines = body.split('\n');
    const doneLine = lines.find((l: string) => l.startsWith('data: ') && l.includes('"done"'));
    expect(doneLine).toBeDefined();

    const doneData = JSON.parse(doneLine!.replace('data: ', ''));
    expect(doneData.type).toBe('done');
    expect(doneData.tree).toBeDefined();
    expect(doneData.tree.name).toBe(path.basename(tmpDir));
    expect(doneData.tree.fileCount).toBe(2); // test.txt + nested.txt
    expect(doneData.tree.dirCount).toBe(1); // sub
    expect(doneData.tree.size).toBeGreaterThan(0);
  });
});
