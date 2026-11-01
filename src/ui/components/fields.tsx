import { useEffect, useState, type ReactNode } from 'react';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Select<T extends string | number>(props: { value: T; options: readonly Option<T>[]; onChange: (v: T) => void }) {
  return (
    <select value={String(props.value)} onChange={(e) => props.onChange(props.options.find((o) => String(o.value) === e.target.value)!.value)}>
      {props.options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Slider(props: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <span className="slider">
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
      <output>{props.format ? props.format(props.value) : props.value}</output>
    </span>
  );
}

/** A text input that reports its value only on Enter or blur (e.g. a URL that reconnects when changed). */
export function CommitInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
