import { useEffect, useRef, useState } from 'react';
import { reachable, type Action, type Point, type Project } from '../graph/model';
import type { Cursor } from '../playback/traversal';
import { lineGeometry } from './geometry';
import { defaultViewport, fitViewport, panViewport, worldPoint, type Viewport } from './viewport';

interface CursorControls { begin: (graph: string) => boolean; move: (point: Point, radius: number) => void; end: () => void; cancel: () => void }
interface Props { project: Project; selected: string | null; select: (id: string | null) => void; selectedArrow?: string | null; selectArrow?: (id: string) => void; edit: (action: Action) => void; locked: boolean; cursors: Cursor[]; cursorControls?: CursorControls }
export function Canvas({ project, selected, select, selectedArrow, selectArrow, edit, locked, cursors, cursorControls }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; origin: Point; start: Point; moved: boolean } | null>(null);
  const pan = useRef<{ view: Viewport; start: Point; moved: boolean } | null>(null);
  const [view, setView] = useState(defaultViewport);
  const [panning, setPanning] = useState(false);
  const suppressClick = useRef(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const grab = useRef<{ pointerId: number; offset: Point } | null>(null);
  const controls = useRef(cursorControls); controls.current = cursorControls;
  const scrubbing = locked && cursors.some(c => c.dragging);
  useEffect(() => {
    const release = (event: KeyboardEvent) => { if (event.key === 'Control') setAnchor(null); };
    const blur = () => {
      if (grab.current) { grab.current = null; controls.current?.cancel(); }
      setAnchor(null); drag.current = null; pan.current = null; setPanning(false);
    };
    window.addEventListener('keyup', release); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keyup', release); window.removeEventListener('blur', blur); };
  }, []);
  useEffect(() => { if (locked || !project.nodes.some(n => n.id === anchor)) setAnchor(null); }, [locked, project.nodes, anchor]);
  useEffect(() => { if (locked) drag.current = null; }, [locked]);
  useEffect(() => { if (!locked) grab.current = null; }, [locked]);
  const visible = reachable(project);
  function point(event: { clientX: number; clientY: number }): Point {
    return worldPoint({ x: event.clientX, y: event.clientY }, svg.current!.getBoundingClientRect(), view);
  }
  function finishDrag() {
    suppressClick.current = (drag.current?.moved || pan.current?.moved) ?? false;
    drag.current = null; pan.current = null; setPanning(false);
  }
  function finishGrab(pointerId: number, cancel: boolean) {
    if (!grab.current || grab.current.pointerId !== pointerId) return false;
    grab.current = null; suppressClick.current = true;
    if (cancel) controls.current?.cancel(); else controls.current?.end();
    return true;
  }
  return <div className="canvas-wrap"><div className="view-controls"><span>拖动空白处平移画布</span><button className="secondary" disabled={scrubbing} onClick={() => setView(fitViewport(project.nodes))}>显示全部</button><button className="secondary" disabled={scrubbing} onClick={() => setView(defaultViewport())}>重置视图</button></div><svg ref={svg} className={`canvas ${panning ? 'panning' : ''} ${scrubbing ? 'scrubbing' : ''}`} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} aria-label="声音画布" role="application"
    onDoubleClick={event => { if (!locked && !suppressClick.current && event.target === event.currentTarget) edit({ type: 'add', id: crypto.randomUUID(), point: point(event) }); }}
    onClick={event => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      if (!locked && event.target === event.currentTarget) { select(null); setAnchor(null); }
    }}
    onPointerDown={event => {
      if (event.target !== event.currentTarget || event.button !== 0 || drag.current || pan.current || grab.current) return;
      suppressClick.current = false;
      pan.current = { view, start: { x: event.clientX, y: event.clientY }, moved: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={event => {
      if (grab.current) {
        if (event.pointerId !== grab.current.pointerId) return;
        const position = point(event), offset = grab.current.offset;
        controls.current?.move({ x: position.x - offset.x, y: position.y - offset.y }, 18 * view.width / svg.current!.getBoundingClientRect().width);
        return;
      }
      if (pan.current) {
        const current = { x: event.clientX, y: event.clientY }, previous = pan.current;
        if (Math.hypot(current.x - previous.start.x, current.y - previous.start.y) > 3) previous.moved = true;
        if (previous.moved) { setPanning(true); setView(panViewport(previous.view, previous.start, current, svg.current!.getBoundingClientRect())); }
        return;
      }
      if (locked || !drag.current) return;
      const current = point(event), previous = drag.current;
      if (Math.hypot(current.x - previous.start.x, current.y - previous.start.y) > 3) previous.moved = true;
      if (previous.moved) edit({ type: 'move', id: previous.id, point: { x: previous.origin.x + current.x - previous.start.x, y: previous.origin.y + current.y - previous.start.y } });
    }}
    onPointerUp={event => { if (grab.current) finishGrab(event.pointerId, false); else finishDrag(); }}
    onPointerCancel={event => { if (grab.current) finishGrab(event.pointerId, true); else finishDrag(); }}
    onLostPointerCapture={event => { if (grab.current) finishGrab(event.pointerId, true); else if (drag.current || pan.current) finishDrag(); }}>
    <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cedbd5" /></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6c8b82" /></marker></defs>
    <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#grid)" pointerEvents="none" />
    {project.arrows.map(edge => {
      const from = project.nodes.find(n => n.id === edge.from)!, to = project.nodes.find(n => n.id === edge.to)!;
      const line = lineGeometry(from, to, project.arrows.some(e => e.from === edge.to && e.to === edge.from));
      const d = `M ${line.a.x} ${line.a.y} L ${line.b.x} ${line.b.y}`;
      function chooseArrow() { if (!locked) { select(null); selectArrow?.(edge.id); setAnchor(null); } }
      return <g key={edge.id} data-testid={`edge-${edge.from}-${edge.to}`} role="button" aria-label={`连接 ${from.name} → ${to.name}`} aria-pressed={selectedArrow === edge.id} tabIndex={locked ? -1 : 0}
        className={`arrow ${selectedArrow === edge.id ? 'selected' : ''} ${visible.has(edge.from) ? '' : 'unreachable'}`}
        onClick={event => { event.stopPropagation(); chooseArrow(); }}
        onKeyDown={event => { if (event.key === 'Enter') chooseArrow(); }}
        onDoubleClick={event => { event.stopPropagation(); if (!locked) edit({ type: 'disconnect', id: edge.id }); }}>
        <path d={d} className="edge-hit" /><path d={d} className="edge" markerEnd="url(#arrow)" pointerEvents="none" />
        <text x={line.label.x} y={line.label.y} className="edge-label" textAnchor="middle">{(line.length / project.speed).toFixed(2)} s</text>
      </g>;
    })}
    {project.nodes.map(node => <g key={node.id} role="button" aria-label={node.name} aria-pressed={selected === node.id} tabIndex={locked ? -1 : 0}
      className={`node ${selected === node.id ? 'selected' : ''} ${anchor === node.id ? 'anchor' : ''} ${visible.has(node.id) || !project.arrows.some(e => e.from === node.id || e.to === node.id) ? '' : 'unreachable'}`}
      transform={`translate(${node.x} ${node.y})`}
      onDoubleClick={event => event.stopPropagation()}
      onKeyDown={event => { if (!locked && event.key === 'Enter') select(node.id); }}
      onClick={event => {
        event.stopPropagation(); if (locked) return;
        if (suppressClick.current) { suppressClick.current = false; return; }
        select(node.id);
        if (event.ctrlKey) { if (anchor && anchor !== node.id) edit({ type: 'connect', id: crypto.randomUUID(), from: anchor, to: node.id }); setAnchor(node.id); }
        else setAnchor(null);
      }}
      onPointerDown={event => {
        if (locked || event.ctrlKey || event.button !== 0 || pan.current || drag.current) return;
        event.stopPropagation(); select(node.id); suppressClick.current = false;
        drag.current = { id: node.id, origin: { x: node.x, y: node.y }, start: point(event), moved: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}>
      <circle r="25" /><text textAnchor="middle" dy="5" className="node-count">{node.sounds.length}</text>
      <text textAnchor="middle" y="45" className="node-name">{node.name}</text>
      {project.starts.includes(node.id) && <text textAnchor="middle" y="-37" className="start-label">▶ 起点</text>}
    </g>)}
    {cursors.map((cursor, index) => {
      const edge = project.arrows.find(e => e.id === cursor.edge);
      const from = project.nodes.find(n => n.id === edge?.from), to = project.nodes.find(n => n.id === edge?.to);
      const line = from && to ? lineGeometry(from, to, project.arrows.some(e => e.from === to.id && e.to === from.id)) : undefined;
      const interactive = locked && !cursor.done && !!cursorControls;
      return <g key={cursor.graph} data-testid={`cursor-${cursor.graph}`} role="button" aria-label={`游标 ${index + 1}`} aria-disabled={!interactive} aria-pressed={!!cursor.dragging}
        className={`cursor-handle ${cursor.dragging ? 'held' : ''} ${cursor.paused ? 'paused' : ''}`}
        pointerEvents={interactive ? 'auto' : 'none'}
        onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
        onPointerDown={event => {
          event.stopPropagation(); event.preventDefault();
          if (!interactive || event.button !== 0 || grab.current || pan.current || drag.current) return;
          if (!controls.current?.begin(cursor.graph)) return;
          const position = point(event);
          grab.current = { pointerId: event.pointerId, offset: { x: position.x - cursor.x - (line?.offset.x ?? 0), y: position.y - cursor.y - (line?.offset.y ?? 0) } };
          svg.current?.setPointerCapture?.(event.pointerId);
        }}
        transform={`translate(${cursor.x + (cursor.done ? 0 : line?.offset.x ?? 0)} ${cursor.y + (cursor.done ? 0 : line?.offset.y ?? 0)})`}>
        <circle className="cursor-hit" r={24 * view.width / 1200} fill="transparent" />
        <circle className={`cursor ${cursor.done ? 'done' : ''}`} r="9" />
        <text y="-16" className="cursor-label" pointerEvents="none">{index + 1}{cursor.done ? ' · 结束' : cursor.dragging ? ` · 独奏 ${Math.round(cursor.progress * 100)}%` : cursor.paused ? ' · 暂停' : ''}</text>
      </g>;
    })}
    {!project.nodes.length && <text x={view.x + view.width / 2} y={view.y + view.height / 2} textAnchor="middle" className="empty-hint" pointerEvents="none">双击任意位置，创建第一个声音结点</text>}
  </svg><div className="canvas-caption">{scrubbing ? '独奏拖动 · 其他游标暂停并静音 · 沿相连线路正反向移动，松开后一起继续' : locked ? '播放中 · 拖动游标可独奏试听 · 可平移查看，结点与声音参数已锁定' : anchor ? '连接中 · Ctrl 点击下一个结点，松开 Ctrl 结束' : '拖动空白平移 · 双击添加 · 拖动结点移动 · Ctrl 依次点击连接 · 单击线编辑映射 · 双击线删除 · Del 删除选中项'}</div></div>;
}
