import type { EpisodeOutcome } from '../../sim';

const OUTCOME_TEXT: Record<Exclude<EpisodeOutcome, 'running'>, string> = {
  success: 'Destination reached',
  collision: 'Collision',
  offroad: 'Hit the curb',
  off_route: 'Left the route',
  timeout: 'Timed out',
  stuck: 'Stuck',
};

export function EpisodeBanner({ outcome }: { outcome: EpisodeOutcome | undefined }) {
  if (!outcome || outcome === 'running') return null;
  return <div className={`banner banner-${outcome === 'success' ? 'ok' : 'fail'}`}>{OUTCOME_TEXT[outcome]}</div>;
}

export function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="loading">
      <div className="spinner" />
      Generating city and warming up traffic…
    </div>
  );
}

export function KeyHelp() {
  return (
    <p className="keyhelp">
      <kbd>W A S D</kbd>/<kbd>arrows</kbd> drive (manual) · <kbd>Space</kbd> pause · <kbd>N</kbd> new episode · <kbd>C</kbd> camera
    </p>
  );
}
