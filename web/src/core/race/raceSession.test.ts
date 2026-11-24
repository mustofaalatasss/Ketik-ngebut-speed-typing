import { describe, expect, it } from 'vitest';
import {
  buildRaceResult,
  countdownValue,
  createRaceSession,
  handleRaceKey,
  tickRace,
  type RaceSessionOptions,
} from './raceSession';

const options: RaceSessionOptions = {
  countdownSeconds: 3,
  timeLimitMs: 10_000,
  typing: { maxErrorBuffer: 8 },
};

describe('Sesi balapan (TYP-4, batas waktu)', () => {
  it('TYP_4_HitungMundur_321LaluMulai', () => {
    const s = createRaceSession('abc', 1_000, options);
    expect(countdownValue(s, 1_000)).toBe(3);
    expect(countdownValue(s, 2_100)).toBe(2);
    expect(countdownValue(s, 3_100)).toBe(1);
    expect(tickRace(s, 3_999).phase).toBe('countdown');
    expect(tickRace(s, 4_000).phase).toBe('racing');
  });

  it('TYP_4_InputSaatHitungMundur_TidakTercatat', () => {
    let s = createRaceSession('abc', 0, options);
    s = handleRaceKey(s, 'a', 500);
    s = handleRaceKey(s, 'b', 2_999);
    expect(s.phase).toBe('countdown');
    expect(s.typing.log).toHaveLength(0);
    expect(s.typing.cursor).toBe(0);
    expect(s.typing.totalKeystrokes).toBe(0);
  });

  it('TYP_4_WaktuKeystroke_RelatifTerhadapMulai', () => {
    let s = createRaceSession('abc', 10_000, options);
    s = handleRaceKey(s, 'a', 13_250.4);
    expect(s.typing.log).toEqual([{ key: 'a', t: 250 }]);
  });

  it('GAM_4_TeksSelesai_StatusSelesai', () => {
    let s = createRaceSession('ab', 0, options);
    s = handleRaceKey(s, 'a', 3_600);
    s = handleRaceKey(s, 'b', 4_200);
    expect(s.phase).toBe('finished');
    const result = buildRaceResult(s, 'p1');
    expect(result.status).toBe('finished');
    expect(result.durationMs).toBe(1_200);
    expect(result.correctChars).toBe(2);
  });

  it('GAM_4_LewatBatasWaktu_StatusTidakSelesai', () => {
    let s = createRaceSession('abcdef', 0, options);
    s = handleRaceKey(s, 'a', 4_000);
    s = tickRace(s, 3_000 + 10_000);
    expect(s.phase).toBe('timeout');

    // Input setelah batas waktu diabaikan.
    s = handleRaceKey(s, 'b', 13_500);
    expect(s.typing.cursor).toBe(1);

    const result = buildRaceResult(s, 'p1');
    expect(result.status).toBe('timeout');
    expect(result.durationMs).toBe(10_000);
  });
});
