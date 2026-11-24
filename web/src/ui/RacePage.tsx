import { useEffect, useRef, useState } from 'react';
import { AudioEngine, type SoundSink } from '../audio/audioEngine';
import type { Opponent } from '../core/bots/opponents';
import type { Standing } from '../core/bots/standings';
import type { RaceResult } from '../core/race/raceSession';
import type { FrameScheduler } from '../game/gameLoop';
import { createRaceStores, RaceController } from '../game/raceController';
import type { Passage } from '../data/passages';
import { RaceScene } from '../scene/RaceScene';
import type { RaceSceneLike, SceneSetup } from '../scene/sceneTypes';
import { Countdown } from './Countdown';
import { Hud } from './Hud';
import { TextDisplay } from './TextDisplay';

export interface RacePageProps {
  readonly passage: Passage;
  readonly carColor: string;
  readonly onFinish: (result: RaceResult, standings: readonly Standing[]) => void;
  /** BOT-4: tiga lawan (bot atau ghost). */
  readonly opponents?: readonly Opponent[];
  readonly playerName?: string;
  readonly showFps?: boolean;
  /** Bisa diganti di test agar tidak butuh WebGL. */
  readonly createScene?: (canvas: HTMLCanvasElement, setup: SceneSetup) => RaceSceneLike;
  readonly scheduler?: FrameScheduler;
  readonly clock?: () => number;
  /** POL-1: suara dibisukan, dan tombol untuk mengubahnya. */
  readonly muted?: boolean;
  readonly onToggleMute?: () => void;
  /** Bisa diganti di test (jsdom tidak punya Web Audio). */
  readonly createSound?: (muted: boolean) => SoundSink;
}

const defaultCreateScene = (canvas: HTMLCanvasElement, setup: SceneSetup): RaceSceneLike =>
  new RaceScene(canvas, setup);

const NO_OPPONENTS: readonly Opponent[] = [];
const defaultCreateSound = (muted: boolean): SoundSink => new AudioEngine(muted);

/**
 * GAM-5: komponen ini hanya membuat RaceController (di luar React) satu kali dan menghubungkan store.
 * Tidak ada state React yang berubah per frame; HUD dan teks membaca store masing-masing.
 */
export function RacePage({
  passage,
  carColor,
  onFinish,
  opponents = NO_OPPONENTS,
  playerName,
  showFps = false,
  createScene = defaultCreateScene,
  scheduler,
  clock,
  muted = false,
  onToggleMute,
  createSound = defaultCreateSound,
}: RacePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stores] = useState(() => createRaceStores(passage.text));
  // Satu mesin suara per balapan; status bisu diubah tanpa membuat ulang balapan.
  // Suara hidup selama efek balapan berjalan; status bisu dibaca lewat ref agar mengubahnya
  // tidak membuat ulang balapan.
  const soundRef = useRef<SoundSink | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  useEffect(() => soundRef.current?.setMuted(muted), [muted]);
  // Simpan callback terbaru di ref agar efek tidak perlu dibuat ulang saat parent render.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sound = createSound(mutedRef.current);
    soundRef.current = sound;
    const scene = createScene(canvas, {
      playerColor: carColor,
      opponents: opponents.map((o) => ({ id: o.id, color: o.color, kind: o.kind })),
    });
    const controller = new RaceController({
      passageId: passage.id,
      text: passage.text,
      scene,
      stores,
      opponents,
      playerName,
      playerColor: carColor,
      onFinish: (r, s) => onFinishRef.current(r, s),
      clock,
      scheduler,
      sound,
    });

    const resize = (): void => {
      const host = canvas.parentElement ?? canvas;
      scene.resize(host.clientWidth, host.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    controller.start();

    return () => {
      window.removeEventListener('resize', resize);
      controller.dispose();
      sound.dispose();
      if (soundRef.current === sound) soundRef.current = null;
    };
  }, [passage, carColor, opponents, playerName, createScene, scheduler, clock, stores, createSound]);

  return (
    <div className="race-page">
      <div className="race-canvas-host">
        <canvas ref={canvasRef} className="race-canvas" data-testid="race-canvas" />
      </div>
      <Hud store={stores.hud} showFps={showFps} />
      {onToggleMute && (
        <button
          type="button"
          className="mute-button"
          tabIndex={-1}
          aria-pressed={muted}
          aria-label={muted ? 'Nyalakan suara' : 'Bisukan suara'}
          onMouseDown={(e) => e.preventDefault()} // jangan ambil fokus: spasi tetap untuk mengetik
          onClick={onToggleMute}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
      <Countdown store={stores.phase} />
      <div className="race-bottom">
        <TextDisplay store={stores.typing} />
        <p className="race-hint">Ketik teks di atas. Karakter salah harus dihapus dengan Backspace.</p>
      </div>
    </div>
  );
}
