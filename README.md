# OverDisk2

A modern reimagining of OverDisk — a disk-usage visualizer with an interactive sunburst chart.  
React + Node/TypeScript, runs in the browser against a local Express server.

## Current behavior

- Pick a drive or type a folder path, click **Scan**
- The server walks the directory tree asynchronously and streams progress via SSE
- Once complete, a canvas-based sunburst chart renders the full directory hierarchy
- Each ring = one directory depth level; arcs are sorted by size and colored red → yellow
- Click an arc to drill into that folder (re-roots the chart); click the center circle to go back up
- Hover any arc for a tooltip with name + size
- Side panel shows stats for the selected node: size, file count, dir count, largest children
- Breadcrumb bar tracks the current drill-down path

## How to run

```bash
cd overdisk2
npm install

# Terminal 1 — backend (port 3002)
npx tsx server/index.ts

# Terminal 2 — frontend (port 5173, proxies /api → 3002)
npm run dev
```

Open `http://localhost:5173`. Start with a smaller folder for a quick test.

## Tests

```bash
npm test          # vitest run
npm run test:watch
```

19 tests covering:
- `formatSize` — unit boundaries (B through TB)
- `scanDirectory` — size bubbling, file/dir counting, sort order, nested/empty dirs, inaccessible paths, progress callback
- API endpoints — `/api/drives`, `/api/scan` validation + SSE stream parsing

## Project structure

```
overdisk2/
  server/
    app.ts          Express app (exported for tests)
    index.ts         Entry point (calls listen)
    scanner.ts       Async recursive directory walker
    scanner.test.ts
    app.test.ts
  src/
    main.tsx
    App.tsx          Shell: drive picker, scan button, layout
    App.css          Dark theme styles
    SunburstChart.tsx Canvas + D3 partition sunburst with drill-down
    StatsPanel.tsx    Selected node stats + top children
    PathBar.tsx       Breadcrumb of current path
    useScanner.ts     React hook consuming SSE scan stream
    types.ts          Shared DirNode type + formatSize
    types.test.ts
```

## What's done (MVP)

- [x] Async recursive scanner (`fs.opendir` + `fs.stat`), works on NTFS/FAT
- [x] SSE streaming so UI shows scan progress without feeling stuck
- [x] Drive auto-detection (A–Z probe)
- [x] Interactive sunburst: canvas rendering, click-to-drill, click-center-to-go-up
- [x] Color coding by relative size (red = large, yellow = small)
- [x] Hover tooltips
- [x] Stats side panel (size, file count, dir count, largest children)
- [x] Path breadcrumb bar
- [x] Test coverage for scanner, API, and utilities

## Phase 2 — "Now help me clean up"

MVP answers *"what's eating my disk?"* — Phase 2 makes the answer **actionable**.

### P0 — Broken / blocking

- [ ] **Breadcrumb click-to-jump** — Path bar segments are inert; clicking a crumb should re-root the chart to that ancestor
- [ ] **Scan cancellation** — No way to abort a long scan; add AbortController plumbing and a Cancel button

### P1 — Make it actionable

- [ ] **Reveal in Explorer** — Right-click or button on any arc / stats-panel entry → `explorer.exe /select,<path>`
- [ ] **Show individual files** — Scanner currently aggregates into dirs only; surface leaf files in the tree so users can spot the 40 GB `.iso` buried three levels deep
- [ ] **File-type breakdown** — Group by extension (`.mp4`, `.node_modules`, `.git`, etc.) with a summary table per folder; this is the #1 "aha" insight for cleanup
- [ ] **Delete / move to trash** — Optional action on selected node with confirmation; recalculate sizes after removal

### P2 — Deeper insight

- [ ] **Allocated vs. logical size** — Show NTFS cluster waste (via `fsutil` or Win32); display both values in stats panel
- [ ] **Top-N largest files (global)** — Flat list of the biggest files across the entire scanned tree, regardless of depth
- [ ] **Treemap alternative view** — Toggle between sunburst and treemap; treemap is better for comparing siblings at the same depth
- [ ] **Age heatmap coloring** — Color arcs by last-modified date instead of size; stale data = cleanup candidate

### P3 — UX polish

- [ ] **Distinguish files from folders** — Different arc style (hatching, border, or opacity) so structure is visible at a glance
- [ ] **Animated drill-down transitions** — Smooth zoom on re-root instead of hard cut
- [ ] **Keyboard navigation** — Arrow keys to move between siblings, Enter to drill in, Backspace to go up
- [ ] **Search / filter** — Type a name or glob pattern to highlight matching arcs
- [ ] **Rescan delta** — Re-scan and diff against previous result; show what grew / shrank

### P4 — Infrastructure (do when needed, not before)

- [ ] **Scan caching** — Persist tree to IndexedDB so reopening the tab doesn't require a re-scan
- [ ] **Electron / Tauri wrapper** — Only worth doing if distribution beyond localhost becomes a real need
- [ ] **Streaming incremental render** — Paint arcs as scan progresses instead of waiting for the full tree

---

## Original vision

> *Preserved below for reference — this is the original description of the classic OverDisk tool.*

OverDisk was a lightweight Windows disk-usage visualizer.

What it did:

* Scanned a drive or folder and measured how space was distributed.
* Displayed the result as an interactive multi-level sunburst chart, where each ring represented deeper directory levels.
* Let you click into sections to drill down through folders and inspect large areas of the disk.
* Distinguished files from folders visually, so you could tell structure at a glance.
* Sorted items by size and color-coded them by relative contribution, roughly from red for very large portions to yellow for small ones.
* Showed per-selection stats such as number of files, number of directories, total size, allocated size, and wasted space.
* Included extra analysis views like file-size histograms and cluster/data-layout information.
* Let you open files or folders directly from the visualization so you could decide what to keep or delete.

In practice, it was a fast “what is eating my disk?” tool with two core ideas:

1. a clickable sunburst view of disk usage
2. efficient directory scanning so you could explore storage without the UI feeling stuck

That is essentially the behavior worth preserving.
