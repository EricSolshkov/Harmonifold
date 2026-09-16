import { validateTone, type Tone } from '../audio';
import { toneFromState } from '../ui/state';
import { components, distance, type Project, type Point } from './model';
import { isMapping, type Mapping } from '../playback/mapping';

export interface CompiledNode extends Point { id: string; tones: Tone[]; outgoing: string[] }
export interface CompiledArrow { id: string; from: string; to: string; duration: number; mapping: Mapping }
export interface CompiledGraph { start: string; nodes: Map<string, CompiledNode>; arrows: Map<string, CompiledArrow> }

export function compileProject(project: Project, sampleRate: number): CompiledGraph[] {
  if (!Number.isFinite(project.speed) || project.speed <= 0 || project.speed > 1000) throw new Error('速度必须大于 0 且不超过 1000。');
  const groups = components(project);
  if (!groups.length) throw new Error('请先连接至少两个结点。');
  return groups.map((ids, index) => {
    const starts = project.starts.filter(id => ids.includes(id));
    if (starts.length !== 1 || !project.arrows.some(e => e.from === starts[0])) throw new Error(`图 ${index + 1} 需要一个具有下行连接的播放起点。`);
    const nodes = new Map<string, CompiledNode>();
    for (const id of ids) {
      const node = project.nodes.find(n => n.id === id);
      if (!node) throw new Error('连接引用了不存在的结点。');
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error(`${node.name} 的位置无效。`);
      if (!node.sounds.length) throw new Error(`${node.name} 的声音数组不能为空。`);
      const tones = node.sounds.map((sound, i) => {
        try { const tone = toneFromState(sound); validateTone(tone, sampleRate); return tone; }
        catch (cause) { throw new Error(`${node.name} · 声音 ${i + 1}：${(cause as Error).message}`); }
      });
      const reference = nodes.values().next().value as CompiledNode | undefined;
      if (reference) {
        if (tones.length !== reference.tones.length) throw new Error(`${node.name} 的声音数量与同图结点不一致（需要 ${reference.tones.length} 个）。`);
        tones.forEach((tone, i) => { if (tone.waveform !== reference.tones[i].waveform) throw new Error(`${node.name} · 声音 ${i + 1} 的波形与同图结点不一致（需要 ${reference.tones[i].waveform}）。`); });
      }
      nodes.set(id, { id, x: node.x, y: node.y, tones, outgoing: project.arrows.filter(e => e.from === id).map(e => e.id) });
    }
    const arrows = new Map<string, CompiledArrow>();
    for (const edge of project.arrows.filter(e => ids.includes(e.from))) {
      const length = distance(nodes.get(edge.from)!, nodes.get(edge.to)!);
      if (!Number.isFinite(length) || !Number.isFinite(length / project.speed)) throw new Error('连接长度或播放时长超出范围。');
      if (length < 0.000001) throw new Error('连接的两个结点位置重叠，请先拖开结点。');
      const mapping = edge.mapping === undefined ? 'linear' : edge.mapping;
      if (!isMapping(mapping)) throw new Error('连接的插值映射无效。');
      arrows.set(edge.id, { ...edge, mapping, duration: length / project.speed });
    }
    return { start: starts[0], nodes, arrows };
  });
}
