import { gameConfig } from '../../config/gameConfig';

/** POL-1: pemetaan kondisi game -> parameter suara. Modul murni (tanpa Web Audio) agar mudah dites. */
export type AudioConfig = typeof gameConfig.audio;

export interface EngineVoice {
  /** Hz */
  readonly frequency: number;
  /** 0..1 */
  readonly gain: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Suara mesin: nada naik mengikuti kecepatan (rasio speed / maxSpeed, 0..1). Mesin tetap "idle"
 * pelan saat diam. Tidak ada suara bila dibisukan atau balapan tidak berjalan.
 */
export function engineVoice(speedRatio: number, active: boolean, muted: boolean, cfg: AudioConfig = gameConfig.audio): EngineVoice {
  const r = clamp01(speedRatio);
  const frequency = cfg.engine.idleHz + (cfg.engine.maxHz - cfg.engine.idleHz) * Math.pow(r, cfg.engine.curve);
  if (muted || !active) return { frequency, gain: 0 };
  const gain = (cfg.engine.idleGain + (cfg.engine.maxGain - cfg.engine.idleGain) * r) * cfg.masterVolume;
  return { frequency, gain };
}

export type BlipKind = 'key' | 'typo';

export interface BlipVoice {
  readonly frequency: number;
  readonly durationSec: number;
  readonly gain: number;
  readonly wave: OscillatorType;
}

/** Bunyi pendek: klik untuk ketikan benar, dengung rendah untuk salah ketik. Null bila dibisukan. */
export function blipVoice(kind: BlipKind, muted: boolean, cfg: AudioConfig = gameConfig.audio): BlipVoice | null {
  if (muted) return null;
  const b = kind === 'key' ? cfg.key : cfg.typo;
  return { frequency: b.frequencyHz, durationSec: b.durationMs / 1000, gain: b.gain * cfg.masterVolume, wave: b.wave };
}
