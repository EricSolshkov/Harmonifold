import { defaults, readState } from '../ui/state';
import { emptyProject, type Project } from './model';
import { isMapping } from '../playback/mapping';

export const storageKey = 'harmonifold.canvas.v1';
export function serializeProject(project: Project): string { return JSON.stringify(project); }
export function parseProject(raw: string): Project {
  const p = JSON.parse(raw) as Project;
  if (!p || p.version !== 1 || !Array.isArray(p.nodes) || !Array.isArray(p.arrows) || !Array.isArray(p.starts) || !Number.isFinite(p.speed)) throw new Error('无法读取画布文件。');
  const ids = new Set<string>();
  for (const node of p.nodes) {
    if (!node || typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Array.isArray(node.sounds)) throw new Error('画布结点数据无效。');
    ids.add(node.id);
    for (const sound of node.sounds) if (!sound || Object.keys(defaults).some(key => typeof sound[key as keyof typeof defaults] !== 'string')) throw new Error('声音参数数据无效。');
  }
  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  for (const edge of p.arrows) {
    if (!edge || typeof edge.id !== 'string' || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || pairs.has(JSON.stringify([edge.from, edge.to]))) throw new Error('画布连接数据无效。');
    edgeIds.add(edge.id); pairs.add(JSON.stringify([edge.from, edge.to]));
    if (edge.mapping !== undefined && !isMapping(edge.mapping)) throw new Error('连接的插值映射无效。');
  }
  if (new Set(p.starts).size !== p.starts.length || p.starts.some(id => !ids.has(id))) throw new Error('播放起点数据无效。');
  return p;
}
export function loadProject(storage: Pick<Storage, 'getItem'>, search: string): Project {
  // Old shared single-tone URLs remain useful as an editable first node.
  if (Object.keys(defaults).some(key => new URLSearchParams(search).has(key))) {
    return { ...emptyProject(), nodes: [{ id: 'imported', name: '结点 1', x: 180, y: 180, sounds: [readState(search)] }] };
  }
  const saved = storage.getItem(storageKey);
  return saved ? parseProject(saved) : emptyProject();
}
