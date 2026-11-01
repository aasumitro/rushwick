import { useEffect, useState } from 'react';

/** Re-read `read()` every `intervalMs` (HUD values change every frame; React need not). */
export function usePolling<T>(read: () => T, intervalMs: number, deps: readonly unknown[]): T {
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    setValue(read());
    const id = window.setInterval(() => setValue(read()), intervalMs);
    return () => window.clearInterval(id);
  }, deps);
  return value;
}
