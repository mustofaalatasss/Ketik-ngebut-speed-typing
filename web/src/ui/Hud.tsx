import { useSyncExternalStore } from 'react';
import type { HudSnapshot } from '../game/raceController';
import type { Store } from '../game/store';
import { formatDuration, formatPercent, formatWpm } from './format';

interface HudProps {
  readonly store: Store<HudSnapshot>;
  readonly showFps?: boolean;
}

/** GAM-3. Membaca store di luar React; render ulang paling sering hud.updateHz kali per detik. */
export function Hud({ store, showFps = false }: HudProps) {
  const hud = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <div className="hud" aria-label="HUD">
      {hud.racers > 1 && (
        <HudItem label="Posisi" value={`${hud.position}/${hud.racers}`} testId="hud-position" />
      )}
      <HudItem label="WPM" value={formatWpm(hud.wpm)} testId="hud-wpm" />
      <HudItem label="Akurasi" value={formatPercent(hud.accuracy)} testId="hud-accuracy" />
      <HudItem label="Progres" value={formatPercent(hud.progress)} testId="hud-progress" />
      <HudItem label="Waktu" value={formatDuration(hud.elapsedMs)} testId="hud-time" />
      <HudItem label="km/j" value={String(hud.speedKmh)} testId="hud-speed" />
      {showFps && (
        <>
          <HudItem label="FPS" value={String(hud.fps)} testId="hud-fps" />
          <HudItem label="draw call" value={String(hud.drawCalls)} testId="hud-draw-calls" />
          <HudItem label="segitiga" value={`${Math.round(hud.triangles / 1000)}k`} testId="hud-triangles" />
          <HudItem label="kualitas" value={String(hud.quality)} testId="hud-quality" />
        </>
      )}
      <div className="hud-progress-bar" aria-hidden="true">
        <div className="hud-progress-fill" style={{ width: formatPercent(hud.progress) }} />
      </div>
    </div>
  );
}

function HudItem({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="hud-item">
      <span className="hud-value" data-testid={testId}>
        {value}
      </span>
      <span className="hud-label">{label}</span>
    </div>
  );
}
