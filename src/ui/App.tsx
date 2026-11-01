import { useEffect, useMemo, useRef, useState } from 'react';
import { Hud } from './components/Hud';
import { MetricsPanel } from './components/MetricsPanel';
import { EpisodeBanner, KeyHelp, LoadingOverlay } from './components/Overlays';
import { RuntimePanel } from './components/RuntimePanel';
import { WorldPanel } from './components/WorldPanel';
import { usePolling } from './hooks/usePolling';
import { useShortcuts } from './hooks/useShortcuts';
import { useSimController } from './hooks/useSimController';
import { CAMERA_MODES, DEFAULT_LIVE, DEFAULT_WORLD, type LiveSettings, type WorldSettings } from './settings';

export function App() {
  const viewport = useRef<HTMLDivElement>(null);
  const controller = useSimController(viewport);
  const [world, setWorld] = useState<WorldSettings>(DEFAULT_WORLD);
  const [live, setLive] = useState<LiveSettings>(DEFAULT_LIVE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!controller) return;
    setLoading(true);
    // Let the loading overlay paint before the (blocking) city generation.
    const id = window.setTimeout(() => {
      controller.loadWorld(world);
      setLoading(false);
    }, 30);
    return () => window.clearTimeout(id);
  }, [controller, world]);

  useEffect(() => controller?.applyLive(live), [controller, live]);

  const snapshot = usePolling(() => controller?.snapshot() ?? null, 200, [controller, loading]);
  const shortcuts = useMemo(
    () => ({
      Space: () => setLive((l) => ({ ...l, paused: !l.paused })),
      KeyN: () => controller?.newEpisode(),
      KeyC: () => setLive((l) => ({ ...l, camera: CAMERA_MODES[(CAMERA_MODES.indexOf(l.camera) + 1) % CAMERA_MODES.length]! })),
    }),
    [controller],
  );
  useShortcuts(shortcuts);

  return (
    <div className="app">
      <div className="viewport" ref={viewport} />
      {snapshot && <Hud s={snapshot} />}
      <EpisodeBanner outcome={snapshot?.metrics?.outcome} />
      <LoadingOverlay visible={loading} />
      <aside className="panel">
        <h2>Rushwick - Urban AV Sim</h2>
        <KeyHelp />
        <RuntimePanel live={live} onChange={setLive} onStep={() => controller?.stepOnce()} onNewEpisode={() => controller?.newEpisode()} />
        <MetricsPanel m={snapshot?.metrics ?? null} episode={snapshot?.episode ?? 0} />
        <WorldPanel world={world} onApply={setWorld} />
      </aside>
    </div>
  );
}
