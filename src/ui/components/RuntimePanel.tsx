import { AGENT_LABELS } from '../controller/agentFactory';
import { CAMERA_MODES, SPEEDS, type AgentKind, type LiveSettings } from '../settings';
import { CommitInput, Field, Select, Toggle } from './fields';

interface Props {
  live: LiveSettings;
  onChange: (live: LiveSettings) => void;
  onStep: () => void;
  onNewEpisode: () => void;
}

const AGENTS = (Object.keys(AGENT_LABELS) as AgentKind[]).map((k) => ({ value: k, label: AGENT_LABELS[k] }));

/** Controls that apply immediately: playback, decision model, camera, overlays. */
export function RuntimePanel({ live, onChange, onStep, onNewEpisode }: Props) {
  const set = <K extends keyof LiveSettings>(key: K, value: LiveSettings[K]) => onChange({ ...live, [key]: value });
  return (
    <section className="panel-section">
      <h3>Run</h3>
      <div className="button-row">
        <button onClick={() => set('paused', !live.paused)}>{live.paused ? '▶ Play' : '⏸ Pause'}</button>
        <button onClick={onStep} disabled={!live.paused}>
          Step
        </button>
        <button onClick={onNewEpisode}>New episode</button>
      </div>
      <Field label="Speed">
        <Select value={live.speed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} onChange={(v) => set('speed', v)} />
      </Field>
      <Field label="Decision model">
        <Select value={live.agent} options={AGENTS} onChange={(v) => set('agent', v)} />
      </Field>
      {live.agent === 'remote' && (
        <Field label="Car program">
          <CommitInput value={live.remoteUrl} onCommit={(v) => set('remoteUrl', v)} />
        </Field>
      )}
      <Field label="Camera">
        <Select value={live.camera} options={CAMERA_MODES.map((c) => ({ value: c, label: c }))} onChange={(v) => set('camera', v)} />
      </Field>
      <Toggle label="Show route" checked={live.showRoute} onChange={(v) => set('showRoute', v)} />
      <Toggle label="Show lidar rays" checked={live.showLidar} onChange={(v) => set('showLidar', v)} />
      <Toggle label="Show sensed objects" checked={live.showSensed} onChange={(v) => set('showSensed', v)} />
      <Toggle label="Auto-restart episodes" checked={live.autoRestart} onChange={(v) => set('autoRestart', v)} />
    </section>
  );
}
