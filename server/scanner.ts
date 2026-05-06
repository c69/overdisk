import fs from 'node:fs/promises';
import path from 'node:path';

export interface DirNode {
  name: string;
  size: number;
  fileCount: number;
  dirCount: number;
  children?: DirNode[];
}

export type ProgressCallback = (scanned: number) => void;

export async function scanDirectory(
  dirPath: string,
  onProgress?: ProgressCallback,
): Promise<DirNode> {
  let scannedCount = 0;

  async function walk(currentPath: string): Promise<DirNode> {
    const node: DirNode = {
      name: path.basename(currentPath) || currentPath,
      size: 0,
      fileCount: 0,
      dirCount: 0,
    };

    let dir;
    try {
      dir = await fs.opendir(currentPath);
    } catch {
      return node;
    }

    const children: DirNode[] = [];

    try {
      for await (const dirent of dir) {
        const fullPath = path.join(currentPath, dirent.name);

        if (dirent.isDirectory()) {
          try {
            const child = await walk(fullPath);
            children.push(child);
            node.size += child.size;
            node.fileCount += child.fileCount;
            node.dirCount += 1 + child.dirCount;
          } catch {
            // Skip inaccessible directories
          }
        } else if (dirent.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            node.size += stat.size;
            node.fileCount += 1;
          } catch {
            // Skip files we can't stat
          }
        }

        scannedCount++;
        if (onProgress && scannedCount % 500 === 0) {
          onProgress(scannedCount);
        }
      }
    } catch {
      // Error during iteration
    }

    if (children.length > 0) {
      children.sort((a, b) => b.size - a.size);
      node.children = children;
    }

    return node;
  }

  return walk(dirPath);
}
