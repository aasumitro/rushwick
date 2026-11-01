import { useState } from 'react';
import type { WorldSettings } from '../settings';
import { Field, Select, Slider } from './fields';

interface Props {
  world: WorldSettings;
  onApply: (world: WorldSettings) => void;
}

/** Settings that regenerate the city; edited as a draft and applied explicitly. */
export function WorldPanel({ world, onApply }: Props) {
  const [draft, setDraft] = useState(world);
  const set = <K extends keyof WorldSettings>(key: K, value: WorldSettings[K]) => setDraft({ ...draft, [key]: value });
  return (
    <section className="panel-section">
      <h3>City</h3>
      <Field label="Seed">
        <input type="number" value={draft.seed} onChange={(e) => set('seed', Math.trunc(Number(e.target.value)) || 0)} />
      </Field>
      <Field label="Driving side">
        <Select
          value={draft.drivingSide}
          options={[
            { value: 'left', label: 'Left (Indonesia, Japan, UK)' },
            { value: 'right', label: 'Right (US, EU, China)' },
          ]}
          onChange={(v) => set('drivingSide', v)}
        />
      </Field>
      <Field label="Signals">
        <Select
          value={draft.signalMode}
          options={[
            { value: 'mixed', label: 'Mixed (permissive turns)' },
            { value: 'protected', label: 'Protected turns only' },
          ]}
          onChange={(v) => set('signalMode', v)}
        />
      </Field>
      <Field label="Vehicles">
        <Slider value={draft.vehicleCount} min={0} max={500} step={10} onChange={(v) => set('vehicleCount', v)} />
      </Field>
      <Field label="Pedestrians">
        <Slider value={draft.pedestrianCount} min={0} max={1200} step={20} onChange={(v) => set('pedestrianCount', v)} />
      </Field>
      <Field label="Jaywalking">
        <Slider value={draft.jaywalkProbability} min={0} max={0.2} step={0.01} onChange={(v) => set('jaywalkProbability', v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Field>
      <div className="button-row">
        <button onClick={() => onApply(draft)}>Regenerate city</button>
        <button onClick={() => setDraft({ ...draft, seed: Math.floor(Math.random() * 1e6) })}>Random seed</button>
      </div>
    </section>
  );
}
