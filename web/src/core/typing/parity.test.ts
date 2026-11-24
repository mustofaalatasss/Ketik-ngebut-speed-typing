import { describe, expect, it } from 'vitest';
import fixture from '../../../../shared/fixtures/typing-replay.json';
import backendSettings from '../../../../src/KetikNgebut.Api/appsettings.json';
import { gameConfig } from '../../config/gameConfig';
import { computeStats } from './metrics';
import { replay } from './replay';
import type { Keystroke } from './types';

interface FixtureCase {
  readonly name: string;
  readonly text: string;
  readonly maxErrorBuffer: number;
  readonly nowMs: number;
  readonly log: readonly Keystroke[];
  readonly expected: {
    readonly cursor: number;
    readonly errorBuffer: string;
    readonly correctKeystrokes: number;
    readonly totalKeystrokes: number;
    readonly finishedAtMs: number | null;
    readonly logLength: number;
    readonly correctCharTimes: readonly number[];
    readonly wpm: number;
    readonly accuracy: number;
    readonly netWpm: number;
    readonly progress: number;
    readonly elapsedMs: number;
  };
}

const cases = fixture.cases as readonly FixtureCase[];

/**
 * Fixture yang sama dites oleh xUnit (tests/KetikNgebut.Tests/Typing/TypingEngineParityTests.cs).
 * Bila keduanya lulus, mesin mengetik TypeScript dan C# memberi hasil identik (RES-2).
 */
describe('Paritas mesin mengetik TypeScript dan C# (RES-2)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('RES_2_ReplayFixture_SamaDenganCSharp: %s', (_name, c) => {
    const state = replay(c.text, c.log, { maxErrorBuffer: c.maxErrorBuffer });
    const stats = computeStats(state, c.nowMs);

    expect({
      cursor: state.cursor,
      errorBuffer: state.errorBuffer,
      correctKeystrokes: state.correctKeystrokes,
      totalKeystrokes: state.totalKeystrokes,
      finishedAtMs: state.finishedAtMs,
      logLength: state.log.length,
      correctCharTimes: state.correctCharTimes,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      netWpm: stats.netWpm,
      progress: stats.progress,
      elapsedMs: stats.elapsedMs,
    }).toStrictEqual(c.expected);
  });

  it('RES_2_FixtureBersama_PunyaKasus', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  it('RES_2_KonfigurasiTypingSamaDenganBackend', () => {
    expect(backendSettings.Typing).toStrictEqual({
      CharsPerWord: gameConfig.charsPerWord,
      MaxErrorBuffer: gameConfig.maxErrorBuffer,
      TimeLimitMs: gameConfig.raceTimeLimitMs,
    });
  });
});
