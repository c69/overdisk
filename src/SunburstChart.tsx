import { useRef, useEffect, useState, useCallback } from 'react';
import { hierarchy, partition, type HierarchyRectangularNode } from 'd3-hierarchy';
import type { DirNode } from './types';
import { formatSize } from './types';

interface Props {
  data: DirNode;
  onSelect: (path: string[], node: DirNode) => void;
}

type ArcNode = HierarchyRectangularNode<DirNode>;

const MAX_DEPTH = 7;

function getColor(node: ArcNode, focus: ArcNode): string {
  const relDepth = node.depth - focus.depth;
  if (relDepth <= 0) return '#555';

  const xRange = focus.x1 - focus.x0;
  const relMid = xRange > 0 ? ((node.x0 + node.x1) / 2 - focus.x0) / xRange : 0;

  const hue = relMid * 50; // 0 = red (largest), 50 = yellow (smallest)
  const lightness = 40 + ((relDepth - 1) % 3) * 10;
  return `hsl(${hue}, 82%, ${lightness}%)`;
}

function buildPath(node: ArcNode): string[] {
  const parts: string[] = [];
  let current: ArcNode | null = node;
  while (current) {
    parts.unshift(current.data.name);
    current = current.parent;
  }
  return parts;
}

export const SunburstChart: React.FC<Props> = ({ data, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<ArcNode | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const rootRef = useRef<ArcNode | null>(null);
  const nodesRef = useRef<ArcNode[]>([]);
  const [tick, setTick] = useState(0);

  // Build hierarchy when data changes
  useEffect(() => {
    const root = hierarchy(data)
      .sum((d) => {
        if (!d.children || d.children.length === 0) return d.size;
        const childrenSize = d.children.reduce((s, c) => s + c.size, 0);
        return Math.max(0, d.size - childrenSize);
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    partition<DirNode>().size([1, 1]).padding(0)(root);

    rootRef.current = root as ArcNode;
    nodesRef.current = (root as ArcNode).descendants();
    setFocus(root as ArcNode);
  }, [data]);

  // Resize observer
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ob = new ResizeObserver(() => setTick((t) => t + 1));
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !focus) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) / 2 - 10;
    const centerR = maxR * 0.15;
    const ringWidth = (maxR - centerR) / MAX_DEPTH;
    const focusDepth = focus.depth;
    const xRange = focus.x1 - focus.x0;

    ctx.clearRect(0, 0, w, h);

    // Draw arcs
    for (const node of nodesRef.current) {
      if (node === focus) continue;
      if (node.depth <= focusDepth) continue;
      if (node.depth > focusDepth + MAX_DEPTH) continue;
      if (node.x1 <= focus.x0 || node.x0 >= focus.x1) continue;

      const relDepth = node.depth - focusDepth;
      const innerR = centerR + (relDepth - 1) * ringWidth;
      const outerR = centerR + relDepth * ringWidth;

      const startAngle =
        ((node.x0 - focus.x0) / xRange) * 2 * Math.PI - Math.PI / 2;
      const endAngle =
        ((node.x1 - focus.x0) / xRange) * 2 * Math.PI - Math.PI / 2;

      if (endAngle - startAngle < 0.002) continue;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = getColor(node, focus);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw center circle
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label =
      focus.data.name.length > 14
        ? focus.data.name.slice(0, 13) + '…'
        : focus.data.name;
    ctx.fillText(label, cx, cy - 10);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(formatSize(focus.value ?? 0), cx, cy + 8);

    if (focus.parent) {
      ctx.fillStyle = '#666';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('▲ click to go up', cx, cy + 24);
    }
  }, [focus, data, tick]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): ArcNode | null => {
      const canvas = canvasRef.current;
      if (!canvas || !focus) return null;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 10;
      const centerR = maxR * 0.15;
      const ringWidth = (maxR - centerR) / MAX_DEPTH;

      const dx = clientX - rect.left - cx;
      const dy = clientY - rect.top - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxR) return null;
      if (dist < centerR) return focus;

      // Mouse angle: 0 at 12 o'clock, clockwise [0, 1)
      let mouseAngle = Math.atan2(dx, -dy);
      if (mouseAngle < 0) mouseAngle += 2 * Math.PI;
      const mouseNorm = mouseAngle / (2 * Math.PI);

      const ringIndex = Math.floor((dist - centerR) / ringWidth) + 1;
      const targetDepth = focus.depth + ringIndex;
      const xRange = focus.x1 - focus.x0;

      for (const node of nodesRef.current) {
        if (node.depth !== targetDepth) continue;
        if (node.x1 <= focus.x0 || node.x0 >= focus.x1) continue;

        const normStart = (node.x0 - focus.x0) / xRange;
        const normEnd = (node.x1 - focus.x0) / xRange;

        if (mouseNorm >= normStart && mouseNorm <= normEnd) {
          return node;
        }
      }

      return null;
    },
    [focus],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const node = hitTest(e.clientX, e.clientY);
      if (!node) return;

      if (node === focus) {
        if (focus.parent) {
          setFocus(focus.parent as ArcNode);
          onSelect(buildPath(focus.parent as ArcNode), focus.parent.data);
        }
      } else if (node.children) {
        setFocus(node);
        onSelect(buildPath(node), node.data);
      } else {
        onSelect(buildPath(node), node.data);
      }
    },
    [focus, hitTest, onSelect],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const node = hitTest(e.clientX, e.clientY);
      if (node && node !== focus) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          text: `${node.data.name} — ${formatSize(node.value ?? 0)}`,
        });
      } else {
        setTooltip(null);
      }
    },
    [focus, hitTest],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top: tooltip.y - 24,
            background: '#222',
            color: '#fff',
            padding: '5px 12px',
            borderRadius: 4,
            fontSize: 13,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            border: '1px solid #444',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};
