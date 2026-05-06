import { describe, it, expect } from 'vitest';
import { formatSize } from './types';

describe('formatSize', () => {
  it('formats bytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(1024 * 100)).toBe('100.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(1024 ** 2)).toBe('1.0 MB');
    expect(formatSize(1024 ** 2 * 256)).toBe('256.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatSize(1024 ** 3)).toBe('1.00 GB');
    expect(formatSize(1024 ** 3 * 60.8)).toBe('60.80 GB');
  });

  it('formats terabytes', () => {
    expect(formatSize(1024 ** 4)).toBe('1.00 TB');
    expect(formatSize(1024 ** 4 * 2.5)).toBe('2.50 TB');
  });
});
