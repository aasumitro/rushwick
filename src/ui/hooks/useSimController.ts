import { useEffect, useRef, useState, type RefObject } from 'react';
import { SimController } from '../controller/simController';

/** Create the controller once the container is mounted; dispose it on unmount. */
export function useSimController(container: RefObject<HTMLDivElement | null>): SimController | null {
  const [controller, setController] = useState<SimController | null>(null);
  const created = useRef<SimController | null>(null);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const c = new SimController(el);
    created.current = c;
    setController(c);
    const onResize = () => c.resize();
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    return () => {
      observer.disconnect();
      c.dispose();
      created.current = null;
      setController(null);
    };
  }, [container]);
  return controller;
}
