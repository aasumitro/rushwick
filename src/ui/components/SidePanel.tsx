import { useState, type ReactNode } from 'react';

/** Right-hand settings panel that slides out of view and back via a tab on its edge. */
export function SidePanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const label = open ? 'Hide panel' : 'Show panel';
  return (
    <aside className={open ? 'panel' : 'panel collapsed'}>
      <button className="panel-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="panel-body" aria-label={label} title={label}>
        {open ? '›' : '‹'}
      </button>
      <div id="panel-body" className="panel-body" inert={!open}>
        {children}
      </div>
    </aside>
  );
}
