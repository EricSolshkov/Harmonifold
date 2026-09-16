import { useEffect, useRef, useState } from 'react';
import { createEnsemble } from './audio/ensemble';
import { components, editProject, emptyProject, type Action } from './graph/model';
import { loadProject, parseProject, serializeProject, storageKey } from './graph/storage';
import type { Cursor } from './playback/traversal';
import { Canvas } from './ui/Canvas';
import { NodeEditor } from './ui/NodeEditor';
import { ArrowEditor } from './ui/ArrowEditor';
import { isTextInput } from './ui/geometry';
import { defaults } from './ui/state';
import './style.css';

export default function App() {
  const [initial] = useState(() => {
    try { return { project: loadProject(localStorage, location.search), error: '' }; }
    catch (cause) { return { project: emptyProject(), error: `恢复画布失败：${(cause as Error).message}` }; }
  });
  const [project, setProject] = useState(initial.project);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedArrow, selectArrow] = useState<string | null>(null);
  function select(id: string | null) { setSelected(id); selectArrow(null); }
  const [mode, setMode] = useState<'edit' | 'starting' | 'playing'>('edit');
  const [error, setError] = useState(initial.error);
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const player = useRef<ReturnType<typeof createEnsemble> | null>(null);
  const lockedRef = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const changed = useRef(false);
  const locked = mode !== 'edit';
  function stop() { player.current?.stop(); lockedRef.current = false; setMode('edit'); }
  useEffect(() => {
    const instance = createEnsemble({ frame: setCursors, ended: () => { lockedRef.current = false; setMode('edit'); }, error: message => { lockedRef.current = false; setMode('edit'); setError(message); } });
    player.current = instance;
    const halt = () => { instance.stop(); lockedRef.current = false; setMode('edit'); };
    const hidden = () => { if (document.hidden) halt(); };
    window.addEventListener('pagehide', halt); document.addEventListener('visibilitychange', hidden);
    return () => { instance.dispose(); player.current = null; window.removeEventListener('pagehide', halt); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!changed.current) return;
    try {
      localStorage.setItem(storageKey, serializeProject(project));
      const url = new URL(location.href);
      const legacy = Object.keys(defaults).some(key => url.searchParams.has(key));
      if (legacy) { Object.keys(defaults).forEach(key => url.searchParams.delete(key)); history.replaceState(null, '', url); }
    }
    catch { setError('本地保存失败，请导出画布文件以保留修改。'); }
  }, [project]);
  function edit(action: Action) {
    if (lockedRef.current) return;
    changed.current = true; setError(''); setCursors([]); setProject(previous => editProject(previous, action));
    if (action.type === 'add') select(action.id);
    if (action.type === 'delete') select(null);
    if (action.type === 'disconnect' && action.id === selectedArrow) selectArrow(null);
  }
  const playRequest = useRef(0);
  async function toggle() {
    const request = ++playRequest.current;
    if (lockedRef.current) { stop(); return; }
    lockedRef.current = true; setMode('starting'); setError(''); setCursors([]);
    try {
      const started = await player.current?.play(project);
      if (request !== playRequest.current) return;
      if (started) setMode('playing');
      else { lockedRef.current = false; setMode('edit'); }
    } catch (cause) { if (request === playRequest.current) { stop(); setError((cause as Error).message); } }
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isTextInput(event.target) || event.repeat) return;
      if (event.code === 'Space' || event.key === ' ') { event.preventDefault(); void toggle(); }
      else if (event.key === 'Delete' && selected && !lockedRef.current) { event.preventDefault(); edit({ type: 'delete', id: selected }); }
      else if (event.key === 'Delete' && selectedArrow && !lockedRef.current) { event.preventDefault(); edit({ type: 'disconnect', id: selectedArrow }); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  const node = project.nodes.find(n => n.id === selected);
  const arrow = project.arrows.find(e => e.id === selectedArrow);
  const groups = components(project);
  function exportFile() {
    const url = URL.createObjectURL(new Blob([serializeProject(project)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'harmonifold.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <main><header><div><p className="eyebrow">CONTINUOUS HARMONY RESEARCH TOOLS</p><h1>Harmonifold <span>声音画布</span></h1></div><div className="file-actions"><button className="secondary" disabled={locked} onClick={() => importInput.current?.click()}>导入</button><button className="secondary" onClick={exportFile}>导出</button><input ref={importInput} aria-label="导入画布" type="file" accept=".json,application/json" hidden disabled={locked} onChange={async event => {
      const input = event.currentTarget, file = input.files?.[0]; if (!file) return;
      try { const next = parseProject(await file.text()); if (!lockedRef.current) { changed.current = true; setProject(next); select(null); setCursors([]); setError(''); } }
      catch (cause) { setError((cause as Error).message); } finally { input.value = ''; }
    }} /></div></header>
    <div className="toolbar"><button onClick={() => void toggle()}>{mode === 'starting' ? '取消启动' : locked ? '■ 停止' : '▶ 播放'}<kbd>Space</kbd></button><label className="speed">速度<input aria-label="播放速度" type="number" min="1" max="1000" value={Number.isFinite(project.speed) ? project.speed : ''} disabled={locked} onChange={event => edit({ type: 'speed', speed: Number(event.target.value) })} /><span>画布单位 / 秒</span></label><span role="status">{locked ? `播放中 · ${cursors.filter(c => !c.done).length} 个图` : `编辑模式 · ${groups.length} 个连通图`}</span></div>
    {error && <p role="alert" className="global-error">{error}</p>}
    <div className="workspace"><div className="canvas-column"><Canvas project={project} selected={selected} select={select} selectedArrow={selectedArrow} selectArrow={selectArrow} edit={edit} locked={locked} cursors={cursors} /><div className="graph-list">{groups.map((ids, i) => { const start = project.nodes.find(n => ids.includes(n.id) && project.starts.includes(n.id)); return <span key={ids[0]}>图 {i + 1} · {ids.length} 结点 · {start ? `起点：${start.name}` : '⚠ 请选择起点'}</span>; })}</div><p className="hint">距离决定时间：Time = Length / Speed。多个图同时出发，独立遍历；环路持续播放，直到停止。</p></div>{arrow ? <ArrowEditor arrow={arrow} fromName={project.nodes.find(n => n.id === arrow.from)!.name} toName={project.nodes.find(n => n.id === arrow.to)!.name} locked={locked} onMapping={mapping => edit({ type: 'mapping', id: arrow.id, mapping })} /> : <NodeEditor node={node} locked={locked} canStart={project.arrows.some(e => e.from === selected)} isStart={!!selected && project.starts.includes(selected)} onStart={() => selected && edit({ type: 'start', id: selected })} onDelete={() => selected && edit({ type: 'delete', id: selected })} onSounds={sounds => selected && edit({ type: 'sounds', id: selected, sounds })} />}</div>
    <footer>修改自动保存在此浏览器 · 导出 JSON 可保存或分享整个画布 · 页面进入后台时停止播放</footer>
  </main>;
}
