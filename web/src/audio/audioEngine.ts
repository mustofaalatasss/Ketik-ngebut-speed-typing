import { blipVoice, engineVoice, type BlipKind } from '../core/audio/soundModel';

/** Bagian Web Audio yang dipakai; bisa dipalsukan di test (jsdom tidak punya AudioContext). */
export type AudioContextLike = Pick<AudioContext, 'currentTime' | 'destination' | 'createOscillator' | 'createGain' | 'close' | 'resume' | 'state'>;

/** Antarmuka yang dipakai RaceController. */
export interface SoundSink {
  /** Dipanggil tiap frame: rasio kecepatan 0..1 dan apakah balapan sedang berjalan. */
  engine(speedRatio: number, active: boolean): void;
  blip(kind: BlipKind): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

function defaultContext(): AudioContextLike | null {
  const Ctor = typeof window === 'undefined' ? undefined : window.AudioContext;
  return Ctor ? new Ctor() : null;
}

const SMOOTH_SEC = 0.08;

/**
 * POL-1: suara dibangkitkan dengan Web Audio API (tanpa berkas audio, jadi bebas hak cipta).
 * AudioContext dibuat saat suara pertama dibutuhkan (setelah pemain menekan tombol), sesuai aturan
 * autoplay browser. Semua node dilepas di dispose() agar tidak bocor memori.
 */
export class AudioEngine implements SoundSink {
  private ctx: AudioContextLike | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private disposed = false;

  constructor(
    private muted: boolean,
    private readonly createContext: () => AudioContextLike | null = defaultContext,
  ) {}

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.engine(0, false);
  }

  engine(speedRatio: number, active: boolean): void {
    const voice = engineVoice(speedRatio, active, this.muted);
    if (voice.gain === 0 && !this.engineOsc) return; // tidak perlu membuat AudioContext untuk diam
    const ctx = this.context();
    if (!ctx) return;
    if (!this.engineOsc || !this.engineGain) {
      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(ctx.destination);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(voice.frequency, ctx.currentTime, SMOOTH_SEC);
    this.engineGain.gain.setTargetAtTime(voice.gain, ctx.currentTime, SMOOTH_SEC);
  }

  blip(kind: BlipKind): void {
    const voice = blipVoice(kind, this.muted);
    if (!voice) return;
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = voice.wave;
    osc.frequency.value = voice.frequency;
    gain.gain.setValueAtTime(voice.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + voice.durationSec);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + voice.durationSec);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.engineOsc?.stop();
    } catch {
      // sudah berhenti
    }
    this.engineOsc?.disconnect();
    this.engineGain?.disconnect();
    this.engineOsc = null;
    this.engineGain = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private context(): AudioContextLike | null {
    if (this.disposed) return null;
    this.ctx ??= this.createContext();
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }
}
