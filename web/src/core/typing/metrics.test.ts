import { describe, expect, it } from 'vitest';
import { computeStats, computeWindowWpm, computeWpm } from './metrics';
import { applyKeystroke, createTypingState } from './typingEngine';

describe('Rumus WPM (TYP-1, GAM-1)', () => {
  it('TYP_1_Wpm_50KarakterDalam12Detik_50Wpm', () => {
    expect(computeWpm(50, 12_000)).toBeCloseTo(50, 10);

    // Lewat mesin: 50 karakter benar, karakter terakhir pada detik ke-12.
    const text = 'a'.repeat(50);
    const times = Array.from({ length: 50 }, (_, i) => Math.round(((i + 1) * 12_000) / 50));
    const state = times.reduce((s, t) => applyKeystroke(s, { key: 'a', t }), createTypingState(text));
    expect(computeStats(state, 99_999).wpm).toBeCloseTo(50, 10);
  });

  it('TYP_1_Wpm_WaktuNol_Nol', () => {
    expect(computeWpm(10, 0)).toBe(0);
  });

  it('GAM_1_WpmJendela_HanyaKeystrokeDalamJendela', () => {
    // 10 karakter lama (detik 0-1) dan 15 karakter dalam 3 detik terakhir (detik 7-10).
    const old = Array.from({ length: 10 }, (_, i) => i * 100);
    const recent = Array.from({ length: 15 }, (_, i) => 7_200 + i * 200);
    const wpm = computeWindowWpm([...old, ...recent], 10_000, 3_000, 1_000);
    // 15 karakter / 5 / (3 s / 60) = 60 WPM
    expect(wpm).toBeCloseTo(60, 10);
  });

  it('GAM_1_WpmJendela_AwalBalapanJendelaDipendekkan', () => {
    // 5 karakter dalam 1,5 detik pertama -> jendela 1,5 s -> 40 WPM
    const times = [300, 600, 900, 1_200, 1_500];
    expect(computeWindowWpm(times, 1_500, 3_000, 1_000)).toBeCloseTo(40, 10);
  });
});
