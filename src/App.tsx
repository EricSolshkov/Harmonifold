import { useEffect, useRef, useState } from 'react';
import { createPlayer, waveforms, type Tone } from './audio';
import { readState, serializeState, toneFromState, type Experiment } from './ui/state';
import './style.css';

export default function App() {
  const [state, setState] = useState(() => readState(location.search));
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [audioError, setAudioError] = useState('');
  const player = useRef<ReturnType<typeof createPlayer> | null>(null);
  let tone: Tone | undefined;
  let error = '';
  try { tone = toneFromState(state); } catch (cause) { error = (cause as Error).message; }
  const latestTone = useRef(tone);
  latestTone.current = tone;
  const frequencyHz = tone?.frequencyHz;
  const gain = tone?.gain;
  const waveform = tone?.waveform;
  useEffect(() => {
    const instance = createPlayer();
    player.current = instance;
    const stop = () => { instance.stop(); setPlaying(false); setPending(false); };
    const hidden = () => { if (document.hidden) stop(); };
    const restore = () => { stop(); setState(readState(location.search)); };
    window.addEventListener('popstate', restore);
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      instance.dispose(); player.current = null;
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    url.search = serializeState(state);
    history.replaceState(null, '', url);
  }, [state]);
  useEffect(() => {
    setAudioError('');
    if (frequencyHz === undefined || gain === undefined || waveform === undefined) {
      player.current?.stop(); setPlaying(false); setPending(false); return;
    }
    try { player.current?.update({ frequencyHz, gain, waveform }); }
    catch (cause) { player.current?.stop(); setPlaying(false); setAudioError((cause as Error).message); }
  }, [frequencyHz, gain, waveform, error]);
  function change(key: keyof Experiment, value: string) { setState(previous => ({ ...previous, [key]: value })); }
  function field(key: keyof Experiment, label: string, step = 'any') {
    return <label>{label}<input type="number" step={step} value={state[key]} onChange={event => change(key, event.target.value)} /></label>;
  }
  async function play() {
    if (!tone || !player.current) return;
    setPending(true); setAudioError('');
    try {
      const started = await player.current.play(tone);
      if (started && latestTone.current) player.current?.update(latestTone.current);
      else if (!latestTone.current) player.current?.stop();
      setPlaying(started && !!latestTone.current);
    }
    catch (cause) { player.current?.stop(); setPlaying(false); setAudioError((cause as Error).message); }
    finally { setPending(false); }
  }
  return <main>
    <header><p className="eyebrow">CONTINUOUS HARMONY RESEARCH TOOLS</p><h1>Harmonifold</h1><p>Arbitrary Frequency &amp; Equal Division Explorer</p></header>
    <section aria-labelledby="experiment-title">
      <h2 id="experiment-title">01 / Frequency experiment</h2>
      <label>Frequency source<select value={state.mode} onChange={event => change('mode', event.target.value)}>
        {!['direct', 'division'].includes(state.mode) && <option value={state.mode}>Invalid mode</option>}
        <option value="division">Equal division</option><option value="direct">Direct frequency</option>
      </select></label>
      <div className="fields">
        {state.mode === 'direct' ? field('frequency', 'Direct Frequency (Hz)') : <>
          {field('base', 'Base Frequency (Hz)')}{field('period', 'Period Ratio')}
          {field('divisions', 'Divisions', '1')}{field('step', 'Step Index', '1')}
        </>}
      </div>
      {state.mode === 'division' && <p className="hint">f(k) = f₀ × R^(k / N) · A period can be any positive ratio.</p>}
      {state.mode === 'division' && Number(state.period) === 1 && <p className="hint">Period ratio 1 is degenerate: every step equals the base frequency.</p>}
    </section>
    <section aria-labelledby="audio-title"><h2 id="audio-title">02 / Listen</h2>
      <div className="fields"><label>Waveform<select value={state.wave} onChange={event => change('wave', event.target.value)}>
        {!waveforms.some(wave => wave === state.wave) && <option value={state.wave}>Invalid waveform</option>}
        {waveforms.map(wave => <option key={wave}>{wave}</option>)}
      </select></label>{field('gain', 'Gain (0–0.2)', '0.01')}</div>
      <div className="readout"><span>Calculated Frequency</span><output aria-live="polite">{frequencyHz === undefined ? '—' : new Intl.NumberFormat('en', { maximumSignificantDigits: 12 }).format(frequencyHz)} <small>Hz</small></output></div>
      {(error || audioError) && <p role="alert">{error || audioError}</p>}
      <div className="transport"><button onClick={() => void play()} disabled={!!error || playing || pending}>{pending ? 'Starting…' : playing ? 'Playing' : 'Play'}</button><button className="secondary" onClick={() => { player.current?.stop(); setPlaying(false); setPending(false); }}>Stop</button><span role="status">{playing ? 'Tone active' : 'Stopped'}</span></div>
      <p className="hint">Start with a low device volume. Playback stops when this page is hidden.</p>
    </section>
    <footer>Parameters are saved in the URL. Copy the address to share this experiment.<br />A research instrument for frequency relationships. Version 0.1.</footer>
  </main>;
}
