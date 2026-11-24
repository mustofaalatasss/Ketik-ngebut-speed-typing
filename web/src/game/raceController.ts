import type { SoundSink } from '../audio/audioEngine';
import { gameConfig } from '../config/gameConfig';
import {
  createCarState,
  registerTypo,
  shakeAmount,
  stepCar,
  type CarState,
} from '../core/game/carPhysics';
import { FrameStats } from '../core/game/frameStats';
import {
  buildRaceResult,
  countdownValue,
  createRaceSession,
  handleRaceKey,
  isRaceOver,
  tickRace,
  type RacePhase,
  type RaceResult,
  type RaceSession,
} from '../core/race/raceSession';
import { finishTime, progressAt } from '../core/bots/botSchedule';
import type { Opponent } from '../core/bots/opponents';
import { computeStandings, livePosition, type Racer, type Standing } from '../core/bots/standings';
import { SmoothedValue } from '../core/visual/smoothing';
import { computeStats, computeWindowWpm } from '../core/typing/metrics';
import type { OpponentFrame, RaceSceneLike } from '../scene/sceneTypes';
import { browserScheduler, GameLoop, type FrameScheduler } from './gameLoop';
import { toTypingKey } from './keyInput';
import { createStore, shallowEqual, type Store } from './store';

export interface HudSnapshot {
  readonly wpm: number;
  readonly accuracy: number;
  readonly progress: number;
  readonly elapsedMs: number;
  readonly speedKmh: number;
  readonly fps: number;
  /** Posisi pemain saat ini (1 = terdepan) dari `racers` mobil. */
  readonly position: number;
  readonly racers: number;
  /** Info debug adegan (hanya ditampilkan dengan `?debug`). */
  readonly drawCalls: number;
  readonly triangles: number;
  readonly quality: number;
}

export interface TypingView {
  readonly text: string;
  readonly cursor: number;
  readonly errorCount: number;
  /** Bertambah setiap salah ketik; dipakai UI untuk memicu animasi getar. */
  readonly typoCount: number;
  readonly finished: boolean;
}

export interface PhaseView {
  readonly phase: RacePhase;
  readonly countdown: number;
}

export interface RaceStores {
  readonly hud: Store<HudSnapshot>;
  readonly typing: Store<TypingView>;
  readonly phase: Store<PhaseView>;
}

export function createRaceStores(text: string): RaceStores {
  return {
    hud: createStore<HudSnapshot>(
      {
        wpm: 0,
        accuracy: 1,
        progress: 0,
        elapsedMs: 0,
        speedKmh: 0,
        fps: 0,
        position: 1,
        racers: 1,
        drawCalls: 0,
        triangles: 0,
        quality: 0,
      },
      shallowEqual,
    ),
    typing: createStore<TypingView>(
      { text, cursor: 0, errorCount: 0, typoCount: 0, finished: false },
      shallowEqual,
    ),
    phase: createStore<PhaseView>(
      { phase: 'countdown', countdown: gameConfig.countdownSeconds },
      shallowEqual,
    ),
  };
}

type KeyTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface RaceControllerDeps {
  readonly passageId: string;
  readonly text: string;
  readonly scene: RaceSceneLike;
  readonly stores: RaceStores;
  /** BOT-5: hasil pemain dan peringkat semua mobil. */
  readonly onFinish: (result: RaceResult, standings: readonly Standing[]) => void;
  /** BOT-4: lawan (3 bot, atau 2 bot + ghost). Kosong = balapan sendirian. */
  readonly opponents?: readonly Opponent[];
  /** Nama pemain di peringkat. */
  readonly playerName?: string;
  readonly playerColor?: string;
  readonly clock?: () => number;
  readonly scheduler?: FrameScheduler;
  readonly keyTarget?: KeyTarget;
  /** POL-1: suara mesin, ketikan, dan salah ketik. Tidak ada = tanpa suara. */
  readonly sound?: SoundSink;
}

/**
 * Pemilik semua state yang berubah cepat: sesi balapan, fisika mobil, statistik frame.
 * Semuanya objek biasa (bukan state React). React hanya menerima snapshot lewat store.
 */
export class RaceController {
  private session: RaceSession;
  private car: CarState = createCarState();
  private readonly frameStats = new FrameStats();
  private readonly loop: GameLoop;
  private readonly clock: () => number;
  private readonly keyTarget: KeyTarget | null;
  private typoCount = 0;
  private lastHudMs = -Infinity;
  private overAtMs: number | null = null;
  private finishNotified = false;
  private disposed = false;
  private readonly opponents: readonly Opponent[];
  /** Objek per lawan yang dipakai ulang setiap frame (tanpa alokasi per frame). */
  private readonly opponentFrames: { id: string; remainingChars: number }[];
  private readonly opponentChars: number[];
  private readonly playerSmooth: SmoothedValue;
  private readonly opponentSmooth: SmoothedValue[];

  constructor(private readonly deps: RaceControllerDeps) {
    this.clock = deps.clock ?? (() => performance.now());
    this.keyTarget = deps.keyTarget ?? (typeof window === 'undefined' ? null : window);
    this.session = createRaceSession(deps.text, this.clock());
    this.loop = new GameLoop((dt) => this.frame(dt), deps.scheduler ?? browserScheduler);
    this.opponents = deps.opponents ?? [];
    this.opponentFrames = this.opponents.map((o) => ({ id: o.id, remainingChars: deps.text.length }));
    this.opponentChars = this.opponents.map(() => 0);
    const { playerTau, opponentTau } = gameConfig.visual.smoothing;
    this.playerSmooth = new SmoothedValue(playerTau);
    this.opponentSmooth = this.opponents.map(() => new SmoothedValue(opponentTau));
  }

  /**
   * Karakter yang dicapai setiap lawan pada waktu balapan `raceT` (dibekukan di batas waktu).
   * `opponentChars` = angka asli (posisi HUD, peringkat); yang dikirim ke adegan diperhalus.
   */
  private updateOpponents(raceT: number, dtSec: number): readonly OpponentFrame[] {
    const t = Math.min(raceT, this.session.options.timeLimitMs);
    const total = this.deps.text.length;
    this.opponents.forEach((o, i) => {
      const chars = progressAt(o.schedule, t);
      this.opponentChars[i] = chars;
      const shown = this.opponentSmooth[i]!.update(chars, dtSec);
      this.opponentFrames[i]!.remainingChars = total - shown;
    });
    return this.opponentFrames;
  }

  /** Sisa karakter pemain untuk adegan: diperhalus, tetapi tepat 0 saat teks selesai. */
  private smoothedRemaining(cursor: number, dtSec: number): number {
    const shown = this.playerSmooth.update(cursor, dtSec);
    if (Math.abs(cursor - shown) < 0.01) this.playerSmooth.snap(cursor);
    return this.deps.text.length - this.playerSmooth.value;
  }

  start(): void {
    this.keyTarget?.addEventListener('keydown', this.onKeyDown);
    this.loop.start();
  }

  /** Melepas semua sumber daya: loop, listener, dan adegan Three.js. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.keyTarget?.removeEventListener('keydown', this.onKeyDown);
    this.deps.scene.dispose();
    this.deps.sound?.engine(0, false);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const key = toTypingKey(e);
    if (key === null) return;
    e.preventDefault(); // cegah spasi menggulir halaman, Backspace kembali, dsb.
    this.handleKey(key);
  };

  handleKey(key: string): void {
    const now = this.clock();
    const before = this.session.typing;
    this.session = handleRaceKey(this.session, key, now);
    this.publishPhase(now);

    const typing = this.session.typing;
    if (typing === before) return;
    if (typing.lastResult === 'incorrect') {
      this.car = registerTypo(this.car, now);
      this.typoCount++;
      this.deps.sound?.blip('typo');
    } else if (typing.lastResult === 'correct') {
      this.deps.sound?.blip('key');
    }
    this.deps.stores.typing.publish({
      text: typing.text,
      cursor: typing.cursor,
      errorCount: typing.errorBuffer.length,
      typoCount: this.typoCount,
      finished: typing.finishedAtMs !== null,
    });
  }

  /** Dipanggil setiap requestAnimationFrame. Tidak ada setState React di sini. */
  private frame(dtSec: number): void {
    const now = this.clock();
    this.session = tickRace(this.session, now);
    this.publishPhase(now);

    const typing = this.session.typing;
    const raceT = now - this.session.startAtMs;
    const racing = this.session.phase === 'racing';
    const times = typing.correctCharTimes;
    const lastCorrect = times.length > 0 ? times[times.length - 1]! : null;

    this.car = stepCar(
      this.car,
      {
        windowWpm: racing ? computeWindowWpm(times, raceT) : 0,
        msSinceLastCorrect: racing && lastCorrect !== null ? raceT - lastCorrect : Infinity,
        nowMs: now,
      },
      dtSec,
    );

    const stats = computeStats(typing, Math.max(0, raceT));
    // Setelah pemain selesai, lawan dibekukan di waktu finis pemain agar posisi akhirnya konsisten.
    const opponentT = this.session.phase === 'finished' ? (typing.finishedAtMs ?? raceT) : raceT;
    const opponents = this.updateOpponents(Math.max(0, opponentT), dtSec);
    this.deps.scene.update({
      opponents,
      dtSec,
      nowMs: now,
      speed: this.car.speed,
      progress: stats.progress,
      remainingChars: this.smoothedRemaining(typing.cursor, dtSec),
      shake: shakeAmount(this.car, now),
      penaltyActive: now < this.car.penaltyUntilMs,
      typoCount: this.typoCount,
    });
    this.frameStats.push(dtSec * 1000);
    this.deps.sound?.engine(this.car.speed / gameConfig.speed.maxSpeed, this.session.phase === 'racing');

    if (now - this.lastHudMs >= 1000 / gameConfig.hud.updateHz) {
      this.lastHudMs = now;
      this.publishHud(stats.wpm, stats.accuracy, stats.progress, this.elapsedMs(raceT));
    }

    this.checkFinish(now);
  }

  private elapsedMs(raceT: number): number {
    const { phase, typing, options } = this.session;
    if (phase === 'countdown') return 0;
    if (phase === 'finished') return typing.finishedAtMs ?? 0;
    if (phase === 'timeout') return options.timeLimitMs;
    return Math.max(0, raceT);
  }

  private publishHud(wpm: number, accuracy: number, progress: number, elapsedMs: number): void {
    // Dibulatkan ke presisi tampilan: snapshot yang sama tidak memicu render ulang.
    const debug = this.deps.scene.getDebugInfo?.() ?? { drawCalls: 0, triangles: 0, quality: 0 };
    this.deps.stores.hud.publish({
      drawCalls: debug.drawCalls,
      triangles: Math.round(debug.triangles / 1000) * 1000,
      quality: debug.quality,
      wpm: Math.round(wpm),
      accuracy: Math.round(accuracy * 1000) / 1000,
      progress: Math.round(progress * 1000) / 1000,
      elapsedMs: Math.floor(elapsedMs / 100) * 100,
      speedKmh: Math.round(this.car.speed * gameConfig.speed.unitsToKmh),
      fps: Math.round(this.frameStats.fps),
      position: livePosition(this.session.typing.cursor, this.opponentChars),
      racers: this.opponents.length + 1,
    });
  }

  /** BOT-5: peringkat semua mobil. Waktu finis bot sudah diketahui dari jadwalnya. */
  private standings(result: RaceResult): Standing[] {
    const total = this.deps.text.length;
    const limit = this.session.options.timeLimitMs;
    const racers: Racer[] = [
      {
        id: 'player',
        name: this.deps.playerName ?? 'Kamu',
        kind: 'player',
        color: this.deps.playerColor ?? '#ffffff',
        finishMs: result.status === 'finished' ? result.durationMs : null,
        correctChars: result.correctChars,
        totalChars: total,
      },
      ...this.opponents.map((o) => ({
        id: o.id,
        name: o.name,
        kind: o.kind,
        color: o.color,
        finishMs: finishTime(o.schedule, total),
        correctChars: Math.floor(progressAt(o.schedule, limit)),
        totalChars: total,
      })),
    ];
    return computeStandings(racers, limit);
  }

  private publishPhase(now: number): void {
    this.deps.stores.phase.publish({
      phase: this.session.phase,
      countdown: countdownValue(this.session, now),
    });
  }

  private checkFinish(now: number): void {
    if (this.finishNotified || !isRaceOver(this.session)) return;
    this.overAtMs ??= now;
    if (now - this.overAtMs >= gameConfig.finishDelayMs) {
      this.finishNotified = true;
      const result = buildRaceResult(this.session, this.deps.passageId);
      this.deps.onFinish(result, this.standings(result));
    }
  }
}
