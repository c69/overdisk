import { useState, useCallback, useEffect } from 'react';
import { useScanner } from './useScanner';
import { SunburstChart } from './SunburstChart';
import { StatsPanel } from './StatsPanel';
import { PathBar } from './PathBar';
import type { DirNode } from './types';
import './App.css';

export const App: React.FC = () => {
  const { status, progress, tree, error, scan } = useScanner();
  const [scanPath, setScanPath] = useState('C:\\');
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<DirNode | null>(null);
  const [drives, setDrives] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/drives')
      .then((r) => r.json())
      .then((d: string[]) => {
        setDrives(d);
        if (d.length > 0 && !d.includes(scanPath)) {
          setScanPath(d[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleScan = useCallback(() => {
    scan(scanPath);
    setSelectedPath([]);
    setSelectedNode(null);
  }, [scan, scanPath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleScan();
    },
    [handleScan],
  );

  const handleSelect = useCallback((path: string[], node: DirNode) => {
    setSelectedPath(path);
    setSelectedNode(node);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>OverDisk2</h1>
        <div className="scan-controls">
          {drives.length > 0 && (
            <select
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              disabled={status === 'scanning'}
            >
              {drives.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Path to scan…"
            disabled={status === 'scanning'}
          />
          <button onClick={handleScan} disabled={status === 'scanning'}>
            {status === 'scanning'
              ? `Scanning… (${progress.toLocaleString()})`
              : 'Scan'}
          </button>
        </div>
      </header>

      {selectedPath.length > 0 && <PathBar path={selectedPath} />}

      <div className="main">
        {status === 'idle' && (
          <div className="placeholder">
            Select a drive or folder and click Scan
          </div>
        )}
        {status === 'scanning' && (
          <div className="placeholder">
            <div>
              <div className="spinner" />
              <div style={{ marginTop: 16 }}>
                Scanning… {progress.toLocaleString()} items found
              </div>
            </div>
          </div>
        )}
        {error && <div className="placeholder error">{error}</div>}
        {status === 'done' && tree && (
          <>
            <div className="chart-area">
              <SunburstChart data={tree} onSelect={handleSelect} />
            </div>
            <div className="stats-area">
              <StatsPanel node={selectedNode ?? tree} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
