import { waveforms } from '../audio';
import { defaults, toneFromState, type Experiment } from './state';
import type { SoundNode } from '../graph/model';

export function NodeEditor({ node, locked, canStart, isStart, onSounds, onStart, onDelete }: { node?: SoundNode; locked: boolean; canStart: boolean; isStart: boolean; onSounds: (sounds: Experiment[]) => void; onStart: () => void; onDelete: () => void }) {
  if (!node) return <aside className="inspector"><p className="eyebrow">SOUND INSPECTOR</p><h2>选择一个结点</h2><p className="hint">每个结点保存一组声音。连接上的游标会连续插值频率与响度。</p><p className="hint">同一连通图内，声音数量及相同位置的波形必须一致；不同图可独立配置。</p></aside>;
  function update(index: number, key: keyof Experiment, value: string) { onSounds(node!.sounds.map((sound, i) => i === index ? { ...sound, [key]: value } : sound)); }
  return <aside className="inspector"><p className="eyebrow">SOUND INSPECTOR</p><h2>{node.name}</h2><fieldset disabled={locked}>
    <div className="node-actions"><button className="secondary" disabled={!canStart || isStart} onClick={onStart}>{isStart ? '▶ 当前图起点' : '设为当前图起点'}</button><button className="danger" onClick={onDelete}>删除结点</button></div>
    {node.sounds.map((sound, index) => {
      let frequency = '—', error = '';
      try { frequency = toneFromState(sound).frequencyHz.toLocaleString('en', { maximumFractionDigits: 6 }); } catch (cause) { error = (cause as Error).message; }
      const field = (key: keyof Experiment, label: string, step = 'any') => <label>{label}<input aria-label={`声音 ${index + 1} ${label}`} type="number" step={step} value={sound[key]} onChange={event => update(index, key, event.target.value)} /></label>;
      return <section className="sound-card" key={index}><div className="sound-heading"><h3>声音 {index + 1}</h3><button className="text-button" aria-label={`删除声音 ${index + 1}`} onClick={() => onSounds(node.sounds.filter((_, i) => i !== index))}>移除</button></div>
        <label>频率来源<select aria-label={`声音 ${index + 1} 频率来源`} value={sound.mode} onChange={event => update(index, 'mode', event.target.value)}><option value="direct">直接频率</option><option value="division">等分计算</option></select></label>
        <div className="fields">{sound.mode === 'direct' ? field('frequency', '频率 (Hz)') : <>{field('base', '基准频率 (Hz)')}{field('period', '周期比')}{field('divisions', '等分数', '1')}{field('step', '步数', '1')}</>}</div>
        {sound.mode === 'division' && <p className="hint">f = f₀ × R^(k / N)</p>}
        <div className="fields"><label>波形<select aria-label={`声音 ${index + 1} 波形`} value={sound.wave} onChange={event => update(index, 'wave', event.target.value)}>{waveforms.map(wave => <option key={wave}>{wave}</option>)}</select></label>{field('gain', '响度 (0–0.2)', '0.01')}</div>
        <p className="frequency">{frequency} <small>Hz</small></p>{error && <p role="alert">{error}</p>}
      </section>;
    })}
    <button className="secondary add-sound" onClick={() => onSounds([...node.sounds, { ...defaults }])}>＋ 添加声音</button>
  </fieldset></aside>;
}
