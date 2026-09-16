import { mappingLabels, mappings, type Mapping } from '../playback/mapping';
import type { Arrow } from '../graph/model';

const descriptions: Record<Mapping, string> = {
  linear: '频率和响度随位置线性过渡。',
  floor: '保持起点的频率和响度，抵达终点时立即切换。',
  smoothstep: '前 95% 路程保持起点声音，最后 5% 平滑过渡到终点声音。',
};
export function ArrowEditor({ arrow, fromName, toName, locked, onMapping }: {
  arrow: Arrow; fromName: string; toName: string; locked: boolean; onMapping: (mapping: Mapping) => void;
}) {
  const mapping = arrow.mapping ?? 'linear';
  return <aside className="inspector"><p className="eyebrow">CONNECTION INSPECTOR</p><h2>{fromName} → {toName}</h2>
    <label>插值映射<select aria-label="连接插值映射" value={mapping} disabled={locked} onChange={event => onMapping(event.target.value as Mapping)}>
      {mappings.map(value => <option key={value} value={value}>{mappingLabels[value]}</option>)}
    </select></label>
    <p className="hint">{descriptions[mapping]}</p>
    <p className="hint">x 是连接上的归一化位置，y 是频率与响度共用的插值参数。游标保持匀速，连接时长仍由距离 / 速度决定。</p>
  </aside>;
}
