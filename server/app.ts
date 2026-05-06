import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanDirectory } from './scanner.js';

export const app = express();
export const PORT = 3002;

// Production: serve built frontend
app.use(express.static(path.join(import.meta.dirname, '../dist')));

app.get('/api/scan', async (req, res) => {
  const scanPath = req.query.path as string;

  if (!scanPath) {
    res.status(400).json({ error: 'Missing "path" query parameter' });
    return;
  }

  try {
    const stat = await fs.stat(scanPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Path is not a directory' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Path does not exist or is not accessible' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const tree = await scanDirectory(scanPath, (scanned) => {
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: 'progress', scanned })}\n\n`);
      }
    });

    if (!aborted) {
      res.write(`data: ${JSON.stringify({ type: 'done', tree })}\n\n`);
      res.end();
    }
  } catch (err) {
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`);
      res.end();
    }
  }
});

app.get('/api/drives', async (_req, res) => {
  const checks = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async (letter) => {
    try {
      await fs.access(`${letter}:\\`);
      return `${letter}:\\`;
    } catch {
      return null;
    }
  });
  const drives = (await Promise.all(checks)).filter(Boolean);
  res.json(drives);
});
