import { defaults } from '../src/ui/state';
import { emptyProject, type Project, type SoundNode } from '../src/graph/model';
export function node(id: string, x = 0, y = 0, frequency = '440'): SoundNode {
  return { id, name: id, x, y, sounds: [{ ...defaults, mode: 'direct', frequency }] };
}
export function graph(): Project {
  return { ...emptyProject(), nodes: [node('A'), node('B', 100, 0, '880')], arrows: [{ id: 'AB', from: 'A', to: 'B' }], starts: ['A'] };
}
export function twoGraphs(): Project {
  return { ...graph(), nodes: [...graph().nodes, node('C', 0, 200), node('D', 200, 200)], arrows: [...graph().arrows, { id: 'CD', from: 'C', to: 'D' }], starts: ['A', 'C'] };
}
