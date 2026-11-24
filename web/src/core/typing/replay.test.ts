import { describe, expect, it } from 'vitest';
import { computeStats } from './metrics';
import { replay } from './replay';
import { applyKeystroke, createTypingState } from './typingEngine';
import { seededRandom } from '../util/random';
import { BACKSPACE, type Keystroke } from './types';

describe('Replay log keystroke (TYP-2)', () => {
  it('TYP_2_ReplayLogSama_WpmDanAkurasiIdentik', () => {
    const text = 'saya suka kopi';
    const log: Keystroke[] = [];
    let t = 0;
    for (const ch of text) {
      t += 180;
      if (ch === 'k') {
        log.push({ key: 'j', t }, { key: BACKSPACE, t: t + 90 });
        t += 180;
      }
      log.push({ key: ch, t });
    }

    const first = replay(text, log);
    const second = replay(text, log);
    const s1 = computeStats(first, 0);
    const s2 = computeStats(second, 0);

    expect(first.finishedAtMs).not.toBeNull();
    expect(s2.wpm).toBe(s1.wpm);
    expect(s2.accuracy).toBe(s1.accuracy);
    expect(s2.netWpm).toBe(s1.netWpm);
    expect(second).toEqual(first);
  });

  it('TYP_2_ReplayLogAcakBerseed_SamaDenganInputLangsung', () => {
    const rand = seededRandom(42);
    const text = 'The quick brown fox jumps over the lazy dog.';
    let live = createTypingState(text);
    let t = 0;
    while (live.finishedAtMs === null && t < 120_000) {
      t += 50 + Math.floor(rand() * 250);
      const r = rand();
      const key =
        live.errorBuffer.length > 0
          ? BACKSPACE
          : r < 0.1
            ? 'x'
            : (text[live.cursor] ?? 'x');
      live = applyKeystroke(live, { key, t });
    }

    const replayed = replay(text, live.log);
    expect(replayed).toEqual(live);
    expect(computeStats(replayed, t)).toEqual(computeStats(live, t));
  });
});
