import { defaults, type Experiment } from '../ui/state';
import type { Mapping } from '../playback/mapping';

export interface Point { x: number; y: number }
export interface SoundNode extends Point { id: string; name: string; sounds: Experiment[] }
export interface Arrow { id: string; from: string; to: string; mapping?: Mapping }
export interface Project { version: 1; nodes: SoundNode[]; arrows: Arrow[]; starts: string[]; speed: number }
export const emptyProject = (): Project => ({ version: 1, nodes: [], arrows: [], starts: [], speed: 100 });
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Weak connectivity: direction controls traversal, not component membership. Isolates are drafts. */
export function components(project: Project): string[][] {
  const adjacent = new Map<string, Set<string>>();
  for (const edge of project.arrows) {
    if (!adjacent.has(edge.from)) adjacent.set(edge.from, new Set());
    if (!adjacent.has(edge.to)) adjacent.set(edge.to, new Set());
    adjacent.get(edge.from)!.add(edge.to); adjacent.get(edge.to)!.add(edge.from);
  }
  const seen = new Set<string>();
  const result: string[][] = [];
  for (const node of project.nodes) {
    if (seen.has(node.id) || !adjacent.has(node.id)) continue;
    const group = [node.id]; seen.add(node.id);
    for (let i = 0; i < group.length; i++) {
      for (const id of adjacent.get(group[i]) ?? []) if (!seen.has(id)) { seen.add(id); group.push(id); }
    }
    result.push(group);
  }
  return result;
}

export function reachable(project: Project): Set<string> {
  const result = new Set(project.starts);
  const queue = [...result];
  for (let i = 0; i < queue.length; i++) {
    for (const edge of project.arrows) if (edge.from === queue[i] && !result.has(edge.to)) {
      result.add(edge.to); queue.push(edge.to);
    }
  }
  return result;
}

export type Action =
  | { type: 'add'; id: string; point: Point }
  | { type: 'move'; id: string; point: Point }
  | { type: 'delete'; id: string }
  | { type: 'connect'; id: string; from: string; to: string }
  | { type: 'disconnect'; id: string }
  | { type: 'mapping'; id: string; mapping: Mapping }
  | { type: 'start'; id: string }
  | { type: 'sounds'; id: string; sounds: Experiment[] }
  | { type: 'speed'; speed: number };

export function editProject(project: Project, action: Action): Project {
  switch (action.type) {
    case 'add': {
      let number = 1;
      while (project.nodes.some(n => n.name === `结点 ${number}`)) number++;
      return { ...project, nodes: [...project.nodes, { ...action.point, id: action.id, name: `结点 ${number}`, sounds: [{ ...defaults }] }] };
    }
    case 'move': return { ...project, nodes: project.nodes.map(n => n.id === action.id ? { ...n, ...action.point } : n) };
    case 'sounds': return { ...project, nodes: project.nodes.map(n => n.id === action.id ? { ...n, sounds: action.sounds } : n) };
    case 'speed': return { ...project, speed: action.speed };
    case 'delete': return { ...project, nodes: project.nodes.filter(n => n.id !== action.id), arrows: project.arrows.filter(e => e.from !== action.id && e.to !== action.id), starts: project.starts.filter(id => id !== action.id) };
    case 'disconnect': return { ...project, arrows: project.arrows.filter(e => e.id !== action.id) };
    case 'mapping': return { ...project, arrows: project.arrows.map(e => e.id === action.id ? { ...e, mapping: action.mapping } : e) };
    case 'start': {
      const group = components(project).find(ids => ids.includes(action.id));
      if (!group || !project.arrows.some(e => e.from === action.id)) return project;
      return { ...project, starts: [...project.starts.filter(id => !group.includes(id)), action.id] };
    }
    case 'connect': {
      if (action.from === action.to || ![action.from, action.to].every(id => project.nodes.some(n => n.id === id)) || project.arrows.some(e => e.from === action.from && e.to === action.to)) return project;
      const groups = components(project);
      const source = groups.find(ids => ids.includes(action.from)) ?? [action.from];
      const target = groups.find(ids => ids.includes(action.to)) ?? [action.to];
      const start = project.starts.find(id => source.includes(id)) ?? project.starts.find(id => target.includes(id)) ?? action.from;
      return { ...project, arrows: [...project.arrows, { id: action.id, from: action.from, to: action.to, mapping: 'linear' }], starts: [...project.starts.filter(id => !source.includes(id) && !target.includes(id)), start] };
    }
  }
}
