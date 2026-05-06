import { useState, useCallback } from 'react';
import type { DirNode } from './types';

interface ScanState {
  status: 'idle' | 'scanning' | 'done' | 'error';
  progress: number;
  tree: DirNode | null;
  error: string | null;
}

export function useScanner() {
  const [state, setState] = useState<ScanState>({
    status: 'idle',
    progress: 0,
    tree: null,
    error: null,
  });

  const scan = useCallback((scanPath: string) => {
    setState({ status: 'scanning', progress: 0, tree: null, error: null });

    const evtSource = new EventSource(`/api/scan?path=${encodeURIComponent(scanPath)}`);

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        setState((s) => ({ ...s, progress: data.scanned }));
      } else if (data.type === 'done') {
        setState({ status: 'done', progress: 0, tree: data.tree, error: null });
        evtSource.close();
      } else if (data.type === 'error') {
        setState((s) => ({ ...s, status: 'error', error: data.message }));
        evtSource.close();
      }
    };

    evtSource.onerror = () => {
      setState((s) => ({
        ...s,
        status: s.status === 'done' ? 'done' : 'error',
        error: s.status === 'done' ? null : 'Connection lost',
      }));
      evtSource.close();
    };
  }, []);

  return { ...state, scan };
}
